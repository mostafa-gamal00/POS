-- An invoice saves when the product lines do not add up to the invoice total.
-- The gap stays on the invoice. A later edit changes lines and moves stock only by the difference.
-- Money rules match src/lib/purchase-invoice.ts.

create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_notes text,
  p_items jsonb,
  p_invoice_total text,
  p_invoice_currency text,
  p_exchange_rate text,
  p_transport text,
  p_transport_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_receipt text;
  v_item jsonb;
  v_prepared jsonb := '[]'::jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_category uuid;
  v_currency text;
  v_unit_price numeric;
  v_invoice_currency text;
  v_transport_currency text;
  v_needs_rate boolean;
  v_invoice_amount numeric;
  v_transport_amount numeric;
  v_invoice_sar numeric;
  v_rate numeric;
  v_transport_sar numeric;
  v_invoice_egp numeric(12, 2);
  v_transport_egp numeric(12, 2);
  v_invoice_cents bigint;
  v_transport_cents bigint;
  v_goods_cents bigint := 0;
  v_goods_unit_cents bigint;
  v_total_qty integer := 0;
  v_base bigint;
  v_remainder bigint;
  v_index integer := 0;
  v_count integer;
  v_line_transport bigint;
  v_line_total_cents bigint;
  v_unit_cost_cents bigint;
  v_paid_cents bigint := 0;
  v_serial text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('purchases.manage') then
    raise exception 'Missing permission: purchases.manage';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Items required';
  end if;

  v_invoice_currency := upper(trim(coalesce(p_invoice_currency, '')));
  v_transport_currency := upper(trim(coalesce(p_transport_currency, '')));
  if v_invoice_currency not in ('EGP', 'SAR') or v_transport_currency not in ('EGP', 'SAR') then
    raise exception 'Invalid currency';
  end if;
  if coalesce(p_invoice_total, '') !~ '^\d+(\.\d+)?$' or coalesce(p_transport, '') !~ '^\d+(\.\d+)?$' then
    raise exception 'Invalid invoice amount';
  end if;

  v_invoice_amount := round(p_invoice_total::numeric, 2);
  v_transport_amount := round(p_transport::numeric, 2);
  v_needs_rate := v_invoice_currency = 'SAR'
    or v_transport_currency = 'SAR'
    or exists (
      select 1
      from jsonb_array_elements(p_items) as entered(item)
      where upper(trim(coalesce(entered.item->>'currency', ''))) = 'SAR'
    );
  v_rate := null;
  if v_needs_rate then
    if coalesce(p_exchange_rate, '') !~ '^\d+(\.\d+)?$' then
      raise exception 'Invalid exchange rate';
    end if;
    v_rate := round(p_exchange_rate::numeric, 6);
    if v_rate <= 0 then
      raise exception 'Invalid exchange rate';
    end if;
  end if;

  if v_invoice_currency = 'SAR' then
    v_invoice_sar := v_invoice_amount;
    v_invoice_egp := round(v_invoice_amount * v_rate, 2);
  else
    v_invoice_sar := null;
    v_invoice_egp := v_invoice_amount;
  end if;
  if v_transport_currency = 'SAR' then
    v_transport_sar := v_transport_amount;
    v_transport_egp := round(v_transport_amount * v_rate, 2);
  else
    v_transport_sar := null;
    v_transport_egp := v_transport_amount;
  end if;
  v_invoice_cents := (v_invoice_egp * 100)::bigint;
  v_transport_cents := (v_transport_egp * 100)::bigint;

  perform set_config('app.allow_stock_change', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid qty';
    end if;
    v_currency := upper(trim(coalesce(v_item->>'currency', '')));
    if v_currency not in ('EGP', 'SAR') then
      raise exception 'Invalid currency';
    end if;
    if coalesce(v_item->>'unit_price', '') !~ '^\d+(\.\d+)?$' then
      raise exception 'Invalid unit price';
    end if;
    v_unit_price := round((v_item->>'unit_price')::numeric, 2);
    if v_unit_price < 0 then
      raise exception 'Invalid unit price';
    end if;
    v_category := nullif(v_item->>'category_id', '')::uuid;
    if v_category is not null and not exists (
      select 1 from public.categories where id = v_category
    ) then
      raise exception 'Category not found';
    end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'Product not found';
    end if;
    if not v_product.is_active then
      raise exception 'Product is inactive';
    end if;
    v_serial := nullif(trim(coalesce(v_item->>'serial', '')), '');
    if v_serial is not null and exists (
      select 1
      from jsonb_array_elements(v_prepared) as prepared(item)
      where prepared.item->>'serial' = v_serial
    ) then
      raise exception 'Serial is already used';
    end if;
    if v_currency = 'SAR' then
      v_goods_unit_cents := (round(v_unit_price * v_rate, 2) * 100)::bigint;
    else
      v_goods_unit_cents := (v_unit_price * 100)::bigint;
    end if;
    v_goods_cents := v_goods_cents + (v_goods_unit_cents * v_qty);
    v_total_qty := v_total_qty + v_qty;
    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'category_id', coalesce(v_category, v_product.category_id),
      'qty', v_qty,
      'currency', v_currency,
      'unit_price', v_unit_price,
      'goods_unit_cents', v_goods_unit_cents,
      'serial', v_serial
    ));
  end loop;

  v_base := v_transport_cents / v_total_qty;
  v_remainder := v_transport_cents - (v_base * v_total_qty);
  v_receipt := public.next_receipt_number('purchase');
  insert into public.purchases (
    receipt_number,
    supplier_id,
    received_by,
    total_cost,
    notes,
    invoice_total_sar,
    exchange_rate,
    invoice_total_egp,
    transport_sar,
    transport_egp,
    invoice_currency,
    transport_currency
  )
  values (
    v_receipt,
    p_supplier_id,
    auth.uid(),
    v_invoice_egp,
    p_notes,
    v_invoice_sar,
    v_rate,
    v_invoice_egp,
    v_transport_sar,
    v_transport_egp,
    v_invoice_currency,
    v_transport_currency
  )
  returning id into v_purchase_id;

  v_count := jsonb_array_length(v_prepared);
  for v_item in select * from jsonb_array_elements(v_prepared)
  loop
    v_index := v_index + 1;
    v_qty := (v_item->>'qty')::integer;
    v_goods_unit_cents := (v_item->>'goods_unit_cents')::bigint;
    v_category := nullif(v_item->>'category_id', '')::uuid;
    if v_index = v_count then
      v_line_transport := (v_base * v_qty) + v_remainder;
    else
      v_line_transport := v_base * v_qty;
    end if;
    if v_index = v_count and v_qty = 1 then
      v_unit_cost_cents := v_goods_unit_cents + v_base + v_remainder;
    else
      v_unit_cost_cents := v_goods_unit_cents + v_base;
    end if;
    v_line_total_cents := (v_goods_unit_cents * v_qty) + v_line_transport;
    v_paid_cents := v_paid_cents + v_line_total_cents;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    insert into public.purchase_items (
      purchase_id,
      product_id,
      category_id,
      qty,
      unit_cost,
      line_total,
      currency,
      unit_price,
      transport_egp,
      serial
    )
    values (
      v_purchase_id,
      v_product.id,
      coalesce(v_category, v_product.category_id),
      v_qty,
      (v_unit_cost_cents::numeric / 100),
      (v_line_total_cents::numeric / 100),
      v_item->>'currency',
      (v_item->>'unit_price')::numeric,
      (v_line_transport::numeric / 100),
      nullif(v_item->>'serial', '')
    );
    update public.products
    set stock_qty = stock_qty + v_qty,
        cost = (v_unit_cost_cents::numeric / 100),
        category_id = coalesce(v_category, category_id)
    where id = v_product.id;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (v_product.id, v_qty, 'purchase', 'purchase', v_purchase_id, auth.uid());
  end loop;

  return jsonb_build_object(
    'id', v_purchase_id,
    'receipt_number', v_receipt,
    'total_cost', v_invoice_egp
  );
end;
$$;

grant execute on function public.create_purchase(uuid, text, jsonb, text, text, text, text, text) to authenticated;

create or replace function public.update_purchase(
  p_id uuid,
  p_supplier_id uuid,
  p_notes text,
  p_items jsonb,
  p_invoice_total text,
  p_invoice_currency text,
  p_exchange_rate text,
  p_transport text,
  p_transport_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
  v_item jsonb;
  v_prepared jsonb := '[]'::jsonb;
  v_deltas jsonb := '[]'::jsonb;
  v_product public.products%rowtype;
  v_delta record;
  v_qty integer;
  v_change bigint;
  v_stock integer;
  v_category uuid;
  v_currency text;
  v_unit_price numeric;
  v_invoice_currency text;
  v_transport_currency text;
  v_needs_rate boolean;
  v_invoice_amount numeric;
  v_transport_amount numeric;
  v_invoice_sar numeric;
  v_rate numeric;
  v_transport_sar numeric;
  v_invoice_egp numeric(12, 2);
  v_transport_egp numeric(12, 2);
  v_invoice_cents bigint;
  v_transport_cents bigint;
  v_goods_cents bigint := 0;
  v_goods_unit_cents bigint;
  v_total_qty integer := 0;
  v_base bigint;
  v_remainder bigint;
  v_index integer := 0;
  v_count integer;
  v_line_transport bigint;
  v_line_total_cents bigint;
  v_unit_cost_cents bigint;
  v_serial text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('purchases.manage') then
    raise exception 'Missing permission: purchases.manage';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Items required';
  end if;
  select * into v_purchase from public.purchases where id = p_id for update;
  if not found then
    raise exception 'Purchase not found';
  end if;

  v_invoice_currency := upper(trim(coalesce(p_invoice_currency, '')));
  v_transport_currency := upper(trim(coalesce(p_transport_currency, '')));
  if v_invoice_currency not in ('EGP', 'SAR') or v_transport_currency not in ('EGP', 'SAR') then
    raise exception 'Invalid currency';
  end if;
  if coalesce(p_invoice_total, '') !~ '^\d+(\.\d+)?$' or coalesce(p_transport, '') !~ '^\d+(\.\d+)?$' then
    raise exception 'Invalid invoice amount';
  end if;

  v_invoice_amount := round(p_invoice_total::numeric, 2);
  v_transport_amount := round(p_transport::numeric, 2);
  v_needs_rate := v_invoice_currency = 'SAR'
    or v_transport_currency = 'SAR'
    or exists (
      select 1
      from jsonb_array_elements(p_items) as entered(item)
      where upper(trim(coalesce(entered.item->>'currency', ''))) = 'SAR'
    );
  v_rate := null;
  if v_needs_rate then
    if coalesce(p_exchange_rate, '') !~ '^\d+(\.\d+)?$' then
      raise exception 'Invalid exchange rate';
    end if;
    v_rate := round(p_exchange_rate::numeric, 6);
    if v_rate <= 0 then
      raise exception 'Invalid exchange rate';
    end if;
  end if;

  if v_invoice_currency = 'SAR' then
    v_invoice_sar := v_invoice_amount;
    v_invoice_egp := round(v_invoice_amount * v_rate, 2);
  else
    v_invoice_sar := null;
    v_invoice_egp := v_invoice_amount;
  end if;
  if v_transport_currency = 'SAR' then
    v_transport_sar := v_transport_amount;
    v_transport_egp := round(v_transport_amount * v_rate, 2);
  else
    v_transport_sar := null;
    v_transport_egp := v_transport_amount;
  end if;
  v_invoice_cents := (v_invoice_egp * 100)::bigint;
  v_transport_cents := (v_transport_egp * 100)::bigint;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid qty';
    end if;
    v_currency := upper(trim(coalesce(v_item->>'currency', '')));
    if v_currency not in ('EGP', 'SAR') then
      raise exception 'Invalid currency';
    end if;
    if coalesce(v_item->>'unit_price', '') !~ '^\d+(\.\d+)?$' then
      raise exception 'Invalid unit price';
    end if;
    v_unit_price := round((v_item->>'unit_price')::numeric, 2);
    if v_unit_price < 0 then
      raise exception 'Invalid unit price';
    end if;
    v_category := nullif(v_item->>'category_id', '')::uuid;
    if v_category is not null and not exists (
      select 1 from public.categories where id = v_category
    ) then
      raise exception 'Category not found';
    end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    if not found then
      raise exception 'Product not found';
    end if;
    if not v_product.is_active and not exists (
      select 1
      from public.purchase_items
      where purchase_id = p_id
        and product_id = v_product.id
    ) then
      raise exception 'Product is inactive';
    end if;
    v_serial := nullif(trim(coalesce(v_item->>'serial', '')), '');
    if v_serial is not null and (
      exists (
        select 1
        from jsonb_array_elements(v_prepared) as prepared(item)
        where prepared.item->>'serial' = v_serial
      )
      or exists (
        select 1
        from public.purchase_items
        where serial = v_serial
          and purchase_id is distinct from p_id
      )
    ) then
      raise exception 'Serial is already used';
    end if;
    if v_currency = 'SAR' then
      v_goods_unit_cents := (round(v_unit_price * v_rate, 2) * 100)::bigint;
    else
      v_goods_unit_cents := (v_unit_price * 100)::bigint;
    end if;
    v_goods_cents := v_goods_cents + (v_goods_unit_cents * v_qty);
    v_total_qty := v_total_qty + v_qty;
    v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'category_id', coalesce(v_category, v_product.category_id),
      'qty', v_qty,
      'currency', v_currency,
      'unit_price', v_unit_price,
      'goods_unit_cents', v_goods_unit_cents,
      'serial', v_serial
    ));
  end loop;

  for v_delta in
    select
      coalesce(new_qty.product_id, old_qty.product_id) as product_id,
      coalesce(new_qty.qty, 0) - coalesce(old_qty.qty, 0) as change_qty
    from (
      select
        (entered.item->>'product_id')::uuid as product_id,
        sum((entered.item->>'qty')::integer) as qty
      from jsonb_array_elements(v_prepared) as entered(item)
      group by 1
    ) as new_qty
    full outer join (
      select product_id, sum(qty) as qty
      from public.purchase_items
      where purchase_id = p_id
      group by product_id
    ) as old_qty on old_qty.product_id = new_qty.product_id
    order by 1
  loop
    v_change := v_delta.change_qty;
    select stock_qty into v_stock
    from public.products
    where id = v_delta.product_id
    for update;
    if v_change < 0 and (v_stock is null or v_stock + v_change < 0) then
      raise exception 'Not enough stock to undo this purchase';
    end if;
    v_deltas := v_deltas || jsonb_build_array(jsonb_build_object(
      'product_id', v_delta.product_id,
      'change_qty', v_change
    ));
  end loop;

  v_base := v_transport_cents / v_total_qty;
  v_remainder := v_transport_cents - (v_base * v_total_qty);
  perform set_config('app.allow_stock_change', 'on', true);
  delete from public.purchase_items where purchase_id = p_id;
  update public.purchases
  set supplier_id = p_supplier_id,
      total_cost = v_invoice_egp,
      notes = p_notes,
      invoice_total_sar = v_invoice_sar,
      exchange_rate = v_rate,
      invoice_total_egp = v_invoice_egp,
      transport_sar = v_transport_sar,
      transport_egp = v_transport_egp,
      invoice_currency = v_invoice_currency,
      transport_currency = v_transport_currency
  where id = p_id;

  v_count := jsonb_array_length(v_prepared);
  for v_item in select * from jsonb_array_elements(v_prepared)
  loop
    v_index := v_index + 1;
    v_qty := (v_item->>'qty')::integer;
    v_goods_unit_cents := (v_item->>'goods_unit_cents')::bigint;
    v_category := nullif(v_item->>'category_id', '')::uuid;
    if v_index = v_count then
      v_line_transport := (v_base * v_qty) + v_remainder;
    else
      v_line_transport := v_base * v_qty;
    end if;
    if v_index = v_count and v_qty = 1 then
      v_unit_cost_cents := v_goods_unit_cents + v_base + v_remainder;
    else
      v_unit_cost_cents := v_goods_unit_cents + v_base;
    end if;
    v_line_total_cents := (v_goods_unit_cents * v_qty) + v_line_transport;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    insert into public.purchase_items (
      purchase_id,
      product_id,
      category_id,
      qty,
      unit_cost,
      line_total,
      currency,
      unit_price,
      transport_egp,
      serial
    )
    values (
      p_id,
      v_product.id,
      coalesce(v_category, v_product.category_id),
      v_qty,
      (v_unit_cost_cents::numeric / 100),
      (v_line_total_cents::numeric / 100),
      v_item->>'currency',
      (v_item->>'unit_price')::numeric,
      (v_line_transport::numeric / 100),
      nullif(v_item->>'serial', '')
    );
    update public.products
    set cost = (v_unit_cost_cents::numeric / 100),
        category_id = coalesce(v_category, category_id)
    where id = v_product.id;
  end loop;

  for v_item in select * from jsonb_array_elements(v_deltas)
  loop
    v_change := (v_item->>'change_qty')::bigint;
    if v_change = 0 then
      continue;
    end if;
    update public.products
    set stock_qty = stock_qty + v_change
    where id = (v_item->>'product_id')::uuid;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (
      (v_item->>'product_id')::uuid,
      v_change::integer,
      'purchase',
      'purchase',
      p_id,
      auth.uid()
    );
  end loop;

  return jsonb_build_object(
    'id', p_id,
    'receipt_number', v_purchase.receipt_number,
    'total_cost', v_invoice_egp
  );
end;
$$;

grant execute on function public.update_purchase(uuid, uuid, text, jsonb, text, text, text, text, text) to authenticated;
