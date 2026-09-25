-- Product categories. Receipt lines store the category id at save time.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category_id uuid references public.categories (id);

alter table public.sale_items
  add column if not exists category_id uuid references public.categories (id);

alter table public.purchase_items
  add column if not exists category_id uuid references public.categories (id);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists sale_items_category_id_idx on public.sale_items (category_id);
create index if not exists purchase_items_category_id_idx on public.purchase_items (category_id);

alter table public.categories enable row level security;

create policy categories_select on public.categories
  for select to authenticated
  using (
    public.auth_has_permission('products.view')
    or public.auth_has_permission('pos.sell')
    or public.auth_has_permission('purchases.view')
    or public.auth_has_permission('purchases.manage')
  );

create policy categories_write on public.categories
  for all to authenticated
  using (public.auth_has_permission('products.manage'))
  with check (public.auth_has_permission('products.manage'));

grant select, insert, update, delete on public.categories to authenticated;

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
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid qty';
    end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    if not found or not v_product.is_active then
      raise exception 'Product not found or inactive';
    end if;
    if v_product.stock_qty < v_qty then
      raise exception 'Insufficient stock for %', v_product.name;
    end if;
    v_total := v_total + (v_product.price * v_qty);
  end loop;

  v_receipt := public.next_receipt_number('sale');
  insert into public.sales (receipt_number, sold_by, total_amount, payment_method)
  values (v_receipt, auth.uid(), v_total, p_payment_method)
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::integer;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    v_line := v_product.price * v_qty;
    insert into public.sale_items (sale_id, product_id, category_id, qty, unit_price, line_total)
    values (v_sale_id, v_product.id, v_product.category_id, v_qty, v_product.price, v_line);
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
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid for update;
    v_line := v_cost * v_qty;
    insert into public.purchase_items (purchase_id, product_id, category_id, qty, unit_cost, line_total)
    values (v_purchase_id, v_product.id, v_product.category_id, v_qty, v_cost, v_line);
    update public.products
    set stock_qty = stock_qty + v_qty,
        cost = coalesce(v_cost, cost)
    where id = v_product.id;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (v_product.id, v_qty, 'purchase', 'purchase', v_purchase_id, auth.uid());
  end loop;

  return jsonb_build_object('id', v_purchase_id, 'receipt_number', v_receipt, 'total_cost', v_total);
end;
$$;

