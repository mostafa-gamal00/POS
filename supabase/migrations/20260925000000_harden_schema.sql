-- Harden schema: non-negative stock, timestamps, indexes, stock-change guard.

alter table public.products
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

alter table public.suppliers
  add column if not exists updated_at timestamptz not null default now();

alter table public.products
  drop constraint if exists products_stock_qty_non_negative;

alter table public.products
  add constraint products_stock_qty_non_negative check (stock_qty >= 0);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create or replace function public.guard_product_stock_qty()
returns trigger
language plpgsql
as $$
begin
  if new.stock_qty is distinct from old.stock_qty
     and current_setting('app.allow_stock_change', true) is distinct from 'on' then
    raise exception 'Stock quantity can only change through create_sale, create_purchase, or adjust_stock';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_stock_qty on public.products;
create trigger products_guard_stock_qty
  before update on public.products
  for each row execute function public.guard_product_stock_qty();

create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_product_id_idx on public.sale_items (product_id);
create index if not exists purchase_items_purchase_id_idx on public.purchase_items (purchase_id);
create index if not exists purchase_items_product_id_idx on public.purchase_items (product_id);
create index if not exists stock_movements_product_created_idx
  on public.stock_movements (product_id, created_at desc);
create index if not exists sales_created_at_idx on public.sales (created_at desc);
create index if not exists purchases_created_at_idx on public.purchases (created_at desc);
create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists role_permissions_role_id_idx on public.role_permissions (role_id);

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
    insert into public.sale_items (sale_id, product_id, qty, unit_price, line_total)
    values (v_sale_id, v_product.id, v_qty, v_product.price, v_line);
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
    insert into public.purchase_items (purchase_id, product_id, qty, unit_cost, line_total)
    values (v_purchase_id, v_product.id, v_qty, v_cost, v_line);
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

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_change_qty integer,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('stock.adjust') then
    raise exception 'Missing permission: stock.adjust';
  end if;
  if p_change_qty = 0 then
    raise exception 'Change qty cannot be zero';
  end if;

  perform set_config('app.allow_stock_change', 'on', true);

  update public.products
  set stock_qty = stock_qty + p_change_qty
  where id = p_product_id
    and stock_qty + p_change_qty >= 0;

  if not found then
    if not exists (select 1 from public.products where id = p_product_id) then
      raise exception 'Product not found';
    end if;
    raise exception 'Stock cannot be negative';
  end if;

  insert into public.stock_movements (product_id, change_qty, reason, ref_type, created_by)
  values (p_product_id, p_change_qty, 'adjustment', coalesce(p_note, 'adjustment'), auth.uid());
end;
$$;
