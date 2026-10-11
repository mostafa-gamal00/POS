import { ExportButton } from "@/components/export-button";
import { AppShell } from "@/components/layout/app-shell";
import { StockAdjustForm } from "@/components/products/stock-adjust-form";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

export default async function StockPage() {
  const auth = await requirePermission("stock.adjust");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");
  const products = (data ?? []) as Product[];
  const lowStock = products.filter(
    (product) => product.stock_qty <= product.low_stock_threshold,
  );
  return (
    <AppShell auth={auth} locale={locale} title={messages.navStock}>
      <div className="grid gap-6 lg:grid-cols-2">
        <StockAdjustForm products={products} />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-medium">{messages.lowStock}</h3>
            <ExportButton
              label={messages.exportData}
              filename="low-stock.csv"
              headers={[messages.product, messages.stock]}
              rows={lowStock.map((product) => [product.name, String(product.stock_qty)])}
            />
          </div>
          {lowStock.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{messages.noLowStock}</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {lowStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{product.name}</span>
                  <span className="font-medium text-amber-700">
                    {product.stock_qty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
