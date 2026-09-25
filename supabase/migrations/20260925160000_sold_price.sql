create or replace function public.create_sale(
  p_payment_method text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_receipt text;
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_price numeric(12, 2);
  v_line numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('pos.sell') then
    raise exception 'Missing permission: pos.sell';
  end if;
  if p_payment_method not in ('cash', 'card', 'other') then
    raise exception 'Invalid payment method';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  perform set_config('app.allow_stock_change', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    v_price := coalesce(nullif(v_item->>'unit_price', '')::numeric, (
      select price from public.products where id = (v_item->>'product_id')::uuid
    ));
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid qty';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'Invalid sold price';
    end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    if not found or not v_product.is_active then
      raise exception 'Product not found or inactive';
    end if;
    if v_product.stock_qty < v_qty then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;
    v_total := v_total + (v_price * v_qty);
  end loop;

  v_receipt := public.next_receipt_number('sale');
  insert into public.sales (receipt_number, sold_by, total_amount, payment_method)
  values (v_receipt, auth.uid(), v_total, p_payment_method)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    v_price := coalesce(nullif(v_item->>'unit_price', '')::numeric, v_product.price);
    v_line := v_price * v_qty;
    insert into public.sale_items (sale_id, product_id, category_id, qty, unit_price, line_total)
    values (v_sale_id, v_product.id, v_product.category_id, v_qty, v_price, v_line);
    update public.products set stock_qty = stock_qty - v_qty where id = v_product.id;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (v_product.id, -v_qty, 'sale', 'sale', v_sale_id, auth.uid());
  end loop;

  return jsonb_build_object('id', v_sale_id, 'receipt_number', v_receipt, 'total_amount', v_total);
end;
$$;

create or replace function public.create_purchase(
  p_supplier_id uuid,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_receipt text;
  v_total numeric(12, 2) := 0;
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_cost numeric(12, 2);
  v_line numeric(12, 2);
  v_category uuid;
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

  perform set_config('app.allow_stock_change', 'on', true);

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    v_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid qty';
    end if;
    if v_cost < 0 then
      raise exception 'Invalid unit cost';
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
    v_total := v_total + (v_cost * v_qty);
  end loop;

  v_receipt := public.next_receipt_number('purchase');
  insert into public.purchases (receipt_number, supplier_id, received_by, total_cost, notes)
  values (v_receipt, p_supplier_id, auth.uid(), v_total, p_notes)
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    v_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    v_category := nullif(v_item->>'category_id', '')::uuid;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    v_line := v_cost * v_qty;
    insert into public.purchase_items (purchase_id, product_id, category_id, qty, unit_cost, line_total)
    values (
      v_purchase_id,
      v_product.id,
      coalesce(v_category, v_product.category_id),
      v_qty,
      v_cost,
      v_line
    );
    update public.products
    set stock_qty = stock_qty + v_qty,
        cost = coalesce(v_cost, cost),
        category_id = coalesce(v_category, category_id)
    where id = v_product.id;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (v_product.id, v_qty, 'purchase', 'purchase', v_purchase_id, auth.uid());
  end loop;

  return jsonb_build_object('id', v_purchase_id, 'receipt_number', v_receipt, 'total_cost', v_total);
end;
$$;
