-- POS + Stock: RBAC, catalog, sales, purchases, stock movements

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RBAC
-- ---------------------------------------------------------------------------
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Domain
-- ---------------------------------------------------------------------------
create table public.shop_settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'My Shop',
  receipt_footer text not null default 'Thank you for your business',
  updated_at timestamptz not null default now()
);

insert into public.shop_settings (id) values (1);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  barcode text,
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  stock_qty integer not null default 0,
  image_path text,
  image_url text,
  is_active boolean not null default true,
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  unique (sku),
  unique (barcode)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  sold_by uuid not null references public.profiles (id),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'other')),
  created_at timestamptz not null default now()
);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  supplier_id uuid references public.suppliers (id),
  received_by uuid not null references public.profiles (id),
  total_cost numeric(12, 2) not null check (total_cost >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  product_id uuid not null references public.products (id),
  qty integer not null check (qty > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  change_qty integer not null,
  reason text not null check (reason in ('sale', 'purchase', 'adjustment')),
  ref_type text,
  ref_id uuid,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.receipt_counters (
  kind text primary key check (kind in ('sale', 'purchase')),
  last_value bigint not null default 0
);

insert into public.receipt_counters (kind, last_value) values ('sale', 0), ('purchase', 0);

-- ---------------------------------------------------------------------------
-- Auth helpers
-- ---------------------------------------------------------------------------
create or replace function public.auth_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = 'super_admin'
  );
$$;

create or replace function public.auth_has_permission(permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and p.code = permission_code
    );
$$;

create or replace function public.auth_my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.auth_is_super_admin() then
      coalesce((select array_agg(p.code order by p.code) from public.permissions p), '{}'::text[])
    else
      coalesce((
        select array_agg(distinct p.code order by p.code)
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = auth.uid()
      ), '{}'::text[])
  end;
$$;

create or replace function public.next_receipt_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
  v_prefix text;
begin
  if p_kind = 'sale' then
    v_prefix := 'S-';
  elsif p_kind = 'purchase' then
    v_prefix := 'P-';
  else
    raise exception 'Invalid receipt kind';
  end if;
  update public.receipt_counters
  set last_value = last_value + 1
  where kind = p_kind
  returning last_value into v_next;
  return v_prefix || lpad(v_next::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile bootstrap on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_super_role_id uuid;
  v_user_count integer;
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  );
  select count(*) into v_user_count from public.profiles;
  if v_user_count = 1 then
    select id into v_super_role_id from public.roles where code = 'super_admin';
    if v_super_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, v_super_role_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed permissions & roles
-- ---------------------------------------------------------------------------
insert into public.permissions (code, name, description) values
  ('dashboard.view', 'View dashboard', 'View dashboard totals and alerts'),
  ('pos.sell', 'POS sell', 'Use POS and checkout'),
  ('products.view', 'View products', 'List and view products'),
  ('products.manage', 'Manage products', 'Create and edit products and images'),
  ('stock.adjust', 'Adjust stock', 'Manual stock adjustments'),
  ('sales.view', 'View sales', 'View sales and print sales receipts'),
  ('purchases.view', 'View purchases', 'View purchases and print purchase receipts'),
  ('purchases.manage', 'Manage purchases', 'Receive goods / create purchases'),
  ('suppliers.manage', 'Manage suppliers', 'Create and edit suppliers'),
  ('users.manage', 'Manage users', 'Assign existing roles to users'),
  ('roles.manage', 'Manage roles', 'Create and edit roles and permissions'),
  ('settings.manage', 'Manage settings', 'Edit shop settings');

insert into public.roles (code, name, description, is_system) values
  ('super_admin', 'Super Admin', 'Full access; only role that can manage roles/permissions', true),
  ('owner', 'Owner', 'Manage shop operations except roles/permissions', true),
  ('cashier', 'Cashier', 'Sell and view basic data', true);

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'owner'
  and p.code in (
    'dashboard.view', 'pos.sell', 'products.view', 'products.manage',
    'stock.adjust', 'sales.view', 'purchases.view', 'purchases.manage',
    'suppliers.manage', 'users.manage', 'settings.manage'
  );

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'cashier'
  and p.code in ('dashboard.view', 'pos.sell', 'products.view', 'sales.view');

-- ---------------------------------------------------------------------------
-- Stock RPCs
-- ---------------------------------------------------------------------------
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
  update public.products
  set stock_qty = stock_qty + p_change_qty
  where id = p_product_id;
  if not found then
    raise exception 'Product not found';
  end if;
  if (select stock_qty from public.products where id = p_product_id) < 0 then
    raise exception 'Stock cannot be negative';
  end if;
  insert into public.stock_movements (product_id, change_qty, reason, ref_type, created_by)
  values (p_product_id, p_change_qty, 'adjustment', coalesce(p_note, 'adjustment'), auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.shop_settings enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.receipt_counters enable row level security;

-- Profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.auth_has_permission('users.manage') or public.auth_is_super_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_manage on public.profiles for update to authenticated
  using (public.auth_has_permission('users.manage') or public.auth_is_super_admin());

-- Permissions / roles: read for users.manage or roles.manage; write only super admin
create policy permissions_select on public.permissions for select to authenticated
  using (public.auth_has_permission('users.manage') or public.auth_has_permission('roles.manage') or public.auth_is_super_admin());
create policy permissions_insert on public.permissions for insert to authenticated
  with check (public.auth_is_super_admin());
create policy permissions_update on public.permissions for update to authenticated
  using (public.auth_is_super_admin()) with check (public.auth_is_super_admin());
create policy permissions_delete on public.permissions for delete to authenticated
  using (public.auth_is_super_admin());

create policy roles_select on public.roles for select to authenticated
  using (true);
create policy roles_insert on public.roles for insert to authenticated
  with check (public.auth_is_super_admin());
create policy roles_update on public.roles for update to authenticated
  using (public.auth_is_super_admin()) with check (public.auth_is_super_admin());
create policy roles_delete on public.roles for delete to authenticated
  using (public.auth_is_super_admin() and is_system = false);

create policy role_permissions_select on public.role_permissions for select to authenticated
  using (public.auth_has_permission('users.manage') or public.auth_has_permission('roles.manage') or public.auth_is_super_admin());
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.auth_is_super_admin()) with check (public.auth_is_super_admin());

create policy user_roles_select on public.user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.auth_has_permission('users.manage')
    or public.auth_is_super_admin()
  );
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (
    public.auth_has_permission('users.manage') or public.auth_is_super_admin()
  );
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (
    public.auth_has_permission('users.manage') or public.auth_is_super_admin()
  );

-- Shop settings
create policy shop_settings_select on public.shop_settings for select to authenticated using (true);
create policy shop_settings_update on public.shop_settings for update to authenticated
  using (public.auth_has_permission('settings.manage')) with check (public.auth_has_permission('settings.manage'));

-- Products
create policy products_select on public.products for select to authenticated
  using (public.auth_has_permission('products.view') or public.auth_has_permission('pos.sell'));
create policy products_insert on public.products for insert to authenticated
  with check (public.auth_has_permission('products.manage'));
create policy products_update on public.products for update to authenticated
  using (public.auth_has_permission('products.manage')) with check (public.auth_has_permission('products.manage'));

-- Suppliers
create policy suppliers_select on public.suppliers for select to authenticated
  using (public.auth_has_permission('purchases.view') or public.auth_has_permission('purchases.manage') or public.auth_has_permission('suppliers.manage'));
create policy suppliers_write on public.suppliers for all to authenticated
  using (public.auth_has_permission('suppliers.manage')) with check (public.auth_has_permission('suppliers.manage'));

-- Sales
create policy sales_select on public.sales for select to authenticated
  using (public.auth_has_permission('sales.view'));
create policy sale_items_select on public.sale_items for select to authenticated
  using (public.auth_has_permission('sales.view'));

-- Purchases
create policy purchases_select on public.purchases for select to authenticated
  using (public.auth_has_permission('purchases.view'));
create policy purchase_items_select on public.purchase_items for select to authenticated
  using (public.auth_has_permission('purchases.view'));

-- Stock movements
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (public.auth_has_permission('stock.adjust') or public.auth_has_permission('products.view'));

-- Receipt counters: no direct client access
create policy receipt_counters_deny on public.receipt_counters for all to authenticated
  using (false) with check (false);

-- ---------------------------------------------------------------------------
-- Storage bucket for product images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy product_images_public_read on storage.objects for select
  using (bucket_id = 'product-images');

create policy product_images_auth_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.auth_has_permission('products.manage'));

create policy product_images_auth_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.auth_has_permission('products.manage'));

create policy product_images_auth_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.auth_has_permission('products.manage'));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.auth_is_super_admin() to authenticated;
grant execute on function public.auth_has_permission(text) to authenticated;
grant execute on function public.auth_my_permissions() to authenticated;
grant execute on function public.create_sale(text, jsonb) to authenticated;
grant execute on function public.create_purchase(uuid, text, jsonb) to authenticated;
grant execute on function public.adjust_stock(uuid, integer, text) to authenticated;
