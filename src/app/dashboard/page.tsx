import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { requirePermission } from "@/lib/auth";
import { fill } from "@/lib/i18n";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@/types/database";

export default async function DashboardPage() {
  const auth = await requirePermission("dashboard.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const isoStart = startOfDay.toISOString();
  const [{ data: salesToday }, { data: purchasesToday }, { data: lowStock }] =
    await Promise.all([
      supabase
        .from("sales")
        .select("total_amount")
        .gte("created_at", isoStart),
      supabase
        .from("purchases")
        .select("total_cost")
        .gte("created_at", isoStart),
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("stock_qty", { ascending: true })
        .limit(50),
    ]);
  const salesTotal = (salesToday ?? []).reduce(
    (sum, row) => sum + Number(row.total_amount),
    0,
  );
  const purchasesTotal = (purchasesToday ?? []).reduce(
    (sum, row) => sum + Number(row.total_cost),
    0,
  );
  const lowStockProducts = ((lowStock ?? []) as Product[]).filter(
    (product) => product.stock_qty <= product.low_stock_threshold,
  );
  return (
    <AppShell auth={auth} locale={locale} title={messages.navDashboard}>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-emerald-800">{messages.todaySales}</p>
          <p className="mt-2 text-3xl font-semibold text-teal-950">
            {formatMoney(salesTotal)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {fill(messages.receiptsCount, { count: (salesToday ?? []).length })}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-amber-800">{messages.todayPurchases}</p>
          <p className="mt-2 text-3xl font-semibold text-teal-950">
            {formatMoney(purchasesTotal)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {fill(messages.receiptsCount, {
              count: (purchasesToday ?? []).length,
            })}
          </p>
        </div>
        <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-orange-800">{messages.lowStockItems}</p>
          <p className="mt-2 text-3xl font-semibold text-teal-950">
            {lowStockProducts.length}
          </p>
          <Link
            href="/stock"
            className="mt-2 inline-block text-sm font-medium text-teal-800 underline"
          >
            {messages.reviewStock}
          </Link>
        </div>
      </div>
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-teal-950">{messages.lowStock}</h3>
        {lowStockProducts.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">{messages.allAboveThreshold}</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {lowStockProducts.slice(0, 10).map((product) => (
              <li
                key={product.id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <span className="font-medium text-stone-800">{product.name}</span>
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800">
                  {fill(messages.left, { count: product.stock_qty })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
