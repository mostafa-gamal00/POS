-- Public catalog. Callers can read these views only.
-- The views run as the owner so a visitor does not need a staff login.

alter table public.shop_settings
  add column if not exists phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists address text not null default '',
  add column if not exists about text not null default '';

create or replace view public.storefront_products
with (security_invoker = false, security_barrier = true) as
select
  p.id,
  p.name,
  p.price,
  p.image_url,
  c.name as category_name
from public.products p
left join public.categories c on c.id = p.category_id
where p.is_active
  and p.is_test = false;

create or replace view public.storefront_settings
with (security_invoker = false, security_barrier = true) as
select
  shop_name,
  phone,
  email,
  address,
  about
from public.shop_settings
where id = 1;

revoke all on table public.storefront_products from public;
revoke all on table public.storefront_settings from public;
revoke all on table public.storefront_products from anon, authenticated;
revoke all on table public.storefront_settings from anon, authenticated;
grant select on table public.storefront_products to anon, authenticated;
grant select on table public.storefront_settings to anon, authenticated;
