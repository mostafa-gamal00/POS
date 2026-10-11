export type PermissionCode =
  | "dashboard.view"
  | "pos.sell"
  | "products.view"
  | "products.manage"
  | "stock.adjust"
  | "sales.view"
  | "purchases.view"
  | "purchases.manage"
  | "suppliers.manage"
  | "users.manage"
  | "roles.manage"
  | "settings.manage";

export type PaymentMethod = "cash" | "card" | "other";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: string;
  code: PermissionCode | string;
  name: string;
  description: string;
  created_at: string;
};

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string;
  is_system: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};

export type Product = {
  id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  serial: string | null;
  barcode: string | null;
  price: number;
  cost: number | null;
  stock_qty: number;
  image_path: string | null;
  image_url: string | null;
  is_active: boolean;
  is_test: boolean;
  low_stock_threshold: number;
  categories?: Pick<Category, "id" | "name"> | null;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Sale = {
  id: string;
  receipt_number: string;
  sold_by: string;
  total_amount: number;
  payment_method: PaymentMethod;
  is_test: boolean;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  category_id: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  products?: Pick<Product, "id" | "name" | "sku"> | null;
};

export type PurchaseCurrency = "EGP" | "SAR";

export type Purchase = {
  id: string;
  receipt_number: string;
  supplier_id: string | null;
  received_by: string;
  total_cost: number;
  notes: string | null;
  invoice_total_sar: number | null;
  invoice_currency: PurchaseCurrency | null;
  exchange_rate: number | null;
  invoice_total_egp: number | null;
  transport_sar: number | null;
  transport_currency: PurchaseCurrency | null;
  transport_egp: number | null;
  is_test: boolean;
  created_at: string;
  suppliers?: Pick<Supplier, "id" | "name"> | null;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string;
  category_id: string | null;
  qty: number;
  unit_cost: number;
  line_total: number;
  currency: PurchaseCurrency | null;
  unit_price: number | null;
  transport_egp: number | null;
  serial: string | null;
  products?: Pick<Product, "id" | "name" | "sku"> | null;
};

export type ShopSettings = {
  id: number;
  shop_name: string;
  receipt_footer: string;
  updated_at: string;
};

export type CartItem = {
  product: Product;
  qty: number;
  soldPrice: number;
};

export type SaleRpcResult = {
  id: string;
  receipt_number: string;
  total_amount: number;
};

export type PurchaseRpcResult = {
  id: string;
  receipt_number: string;
  total_cost: number;
};
