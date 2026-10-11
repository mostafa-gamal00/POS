alter table public.products
  add column if not exists is_test boolean not null default false;

alter table public.sales
  add column if not exists is_test boolean not null default false;

alter table public.purchases
  add column if not exists is_test boolean not null default false;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (public.auth_has_permission('dashboard.view'));

create or replace function public.log_test_flag_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if tg_op = 'INSERT' then
    if new.is_test is not true then
      return new;
    end if;
  elsif new.is_test is not distinct from old.is_test then
    return new;
  end if;
  if tg_table_name = 'products' then
    v_label := new.name;
  else
    v_label := new.receipt_number;
  end if;
  if new.is_test then
    v_label := v_label || ' marked as test';
  else
    v_label := v_label || ' unmarked as test';
  end if;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, summary)
  values (auth.uid(), 'mark_test', tg_table_name, new.id, v_label);
  return new;
end;
$$;

drop trigger if exists products_log_test_flag on public.products;
create trigger products_log_test_flag
  after insert or update of is_test on public.products
  for each row execute function public.log_test_flag_change();

drop trigger if exists sales_log_test_flag on public.sales;
create trigger sales_log_test_flag
  after insert or update of is_test on public.sales
  for each row execute function public.log_test_flag_change();

drop trigger if exists purchases_log_test_flag on public.purchases;
create trigger purchases_log_test_flag
  after insert or update of is_test on public.purchases
  for each row execute function public.log_test_flag_change();

create or replace function public.set_product_test(p_id uuid, p_is_test boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('products.manage') then
    raise exception 'Missing permission: products.manage';
  end if;
  update public.products set is_test = p_is_test where id = p_id;
  if not found then
    raise exception 'Product not found';
  end if;
end;
$$;

create or replace function public.set_sale_test(p_id uuid, p_is_test boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('pos.sell') then
    raise exception 'Missing permission: pos.sell';
  end if;
  update public.sales set is_test = p_is_test where id = p_id;
  if not found then
    raise exception 'Sale not found';
  end if;
end;
$$;

create or replace function public.set_purchase_test(p_id uuid, p_is_test boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('purchases.manage') then
    raise exception 'Missing permission: purchases.manage';
  end if;
  update public.purchases set is_test = p_is_test where id = p_id;
  if not found then
    raise exception 'Purchase not found';
  end if;
end;
$$;

create or replace function public.delete_product(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('products.manage') then
    raise exception 'Missing permission: products.manage';
  end if;
  if exists (select 1 from public.sale_items where product_id = p_id)
     or exists (select 1 from public.purchase_items where product_id = p_id) then
    raise exception 'Product is on an invoice';
  end if;
  select name into v_name from public.products where id = p_id;
  if not found then
    raise exception 'Product not found';
  end if;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, summary)
  values (auth.uid(), 'delete_product', 'products', p_id, v_name);
  delete from public.stock_movements where product_id = p_id;
  delete from public.products where id = p_id;
end;
$$;

create or replace function public.delete_sale(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_item record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('pos.sell') then
    raise exception 'Missing permission: pos.sell';
  end if;
  select * into v_sale from public.sales where id = p_id for update;
  if not found then
    raise exception 'Sale not found';
  end if;
  if not v_sale.is_test then
    raise exception 'Only a test sale can be deleted';
  end if;
  perform set_config('app.allow_stock_change', 'on', true);
  for v_item in
    select product_id, qty from public.sale_items where sale_id = p_id
  loop
    update public.products
    set stock_qty = stock_qty + v_item.qty
    where id = v_item.product_id;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (v_item.product_id, v_item.qty, 'adjustment', 'sale_delete', p_id, auth.uid());
  end loop;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, summary)
  values (auth.uid(), 'delete_sale', 'sales', p_id, v_sale.receipt_number);
  delete from public.sales where id = p_id;
end;
$$;

create or replace function public.delete_purchase(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
  v_item record;
  v_stock integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.auth_has_permission('purchases.manage') then
    raise exception 'Missing permission: purchases.manage';
  end if;
  select * into v_purchase from public.purchases where id = p_id for update;
  if not found then
    raise exception 'Purchase not found';
  end if;
  if not v_purchase.is_test then
    raise exception 'Only a test purchase can be deleted';
  end if;
  for v_item in
    select product_id, sum(qty) as qty
    from public.purchase_items
    where purchase_id = p_id
    group by product_id
  loop
    select stock_qty into v_stock from public.products where id = v_item.product_id for update;
    if v_stock is null or v_stock < v_item.qty then
      raise exception 'Not enough stock to undo this purchase';
    end if;
  end loop;
  perform set_config('app.allow_stock_change', 'on', true);
  for v_item in
    select product_id, qty from public.purchase_items where purchase_id = p_id
  loop
    update public.products
    set stock_qty = stock_qty - v_item.qty
    where id = v_item.product_id;
    insert into public.stock_movements (product_id, change_qty, reason, ref_type, ref_id, created_by)
    values (v_item.product_id, -v_item.qty, 'adjustment', 'purchase_delete', p_id, auth.uid());
  end loop;
  insert into public.activity_logs (actor_id, action, entity_type, entity_id, summary)
  values (auth.uid(), 'delete_purchase', 'purchases', p_id, v_purchase.receipt_number);
  delete from public.purchases where id = p_id;
end;
$$;

grant execute on function public.set_product_test(uuid, boolean) to authenticated;
grant execute on function public.set_sale_test(uuid, boolean) to authenticated;
grant execute on function public.set_purchase_test(uuid, boolean) to authenticated;
grant execute on function public.delete_product(uuid) to authenticated;
grant execute on function public.delete_sale(uuid) to authenticated;
grant execute on function public.delete_purchase(uuid) to authenticated;
