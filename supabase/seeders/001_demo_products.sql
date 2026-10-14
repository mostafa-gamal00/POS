-- Idempotent demo products. Safe to run again with npm run seed.

insert into public.products (
  name, sku, barcode, price, entered_price, price_currency, cost, stock_qty, low_stock_threshold
)
values
  ('Espresso Cup', 'BEV-001', '1000001', 2.50, 2.50, 'EGP', 0.80, 40, 10),
  ('Notebook A5', 'STN-001', '1000002', 4.00, 4.00, 'EGP', 1.50, 25, 5),
  ('USB Cable', 'ELC-001', '1000003', 6.99, 6.99, 'EGP', 2.20, 15, 5),
  ('Water Bottle', 'DRK-001', '1000004', 1.25, 1.25, 'EGP', 0.40, 8, 10)
on conflict (sku) do nothing;
