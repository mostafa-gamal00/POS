-- Product selling price stays in products.price as EGP.
-- entered_price is the amount typed in price_currency.
-- A SAR price stores the rate and price equals that amount converted to EGP.

alter table public.products
  add column if not exists price_currency text,
  add column if not exists entered_price numeric(12, 2),
  add column if not exists price_exchange_rate numeric(12, 6);

update public.products
set
  price_currency = 'EGP',
  entered_price = price,
  price_exchange_rate = null
where price_currency is null
  or entered_price is null;

alter table public.products
  alter column price_currency set default 'EGP',
  alter column price_currency set not null,
  alter column entered_price set not null;

alter table public.products
  drop constraint if exists products_price_currency_check,
  drop constraint if exists products_entered_price_non_negative,
  drop constraint if exists products_price_exchange_rate_positive,
  drop constraint if exists products_price_matches_currency;

alter table public.products
  add constraint products_price_currency_check
    check (price_currency in ('EGP', 'SAR')),
  add constraint products_entered_price_non_negative
    check (entered_price >= 0),
  add constraint products_price_exchange_rate_positive
    check (price_exchange_rate is null or price_exchange_rate > 0),
  add constraint products_price_matches_currency
    check (
      (
        price_currency = 'EGP'
        and price_exchange_rate is null
        and price = entered_price
      )
      or (
        price_currency = 'SAR'
        and price_exchange_rate is not null
        and price = round(entered_price * price_exchange_rate, 2)
      )
    );
