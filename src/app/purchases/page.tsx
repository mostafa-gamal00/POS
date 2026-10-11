import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { ViewLink } from "@/components/products/view-link";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatEnteredPurchaseMoney, formatMoney, formatPurchaseMoney } from "@/lib/utils";
import type { Purchase } from "@/types/database";

export default async function PurchasesPage() {
  const auth = await requirePermission("purchases.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const canManage = hasPermission(auth, "purchases.manage");
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchases")
    .select("*, suppliers(id, name), purchase_items(category_id, categories(name))")
    .order("created_at", { ascending: false })
    .limit(100);
  const purchases = (data ?? []) as Array<
    Purchase & {
      purchase_items?: Array<{ categories?: { name: string } | null }>;
    }
  >;
  return (
    <AppShell auth={auth} locale={locale} title={messages.navPurchases}>
      <div className="mb-4 flex justify-end">
        {canManage ? (
          <Link
            href="/purchases/new"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {messages.receiveGoods}
          </Link>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{messages.receipt}</th>
              <th className="px-4 py-3 font-medium">{messages.supplier}</th>
              <th className="px-4 py-3 font-medium">{messages.date}</th>
              <th className="px-4 py-3 font-medium">{messages.category}</th>
              <th className="px-4 py-3 font-medium">{messages.invoiceTotal}</th>
              <th className="px-4 py-3 font-medium">{messages.exchangeRate}</th>
              <th className="px-4 py-3 font-medium">{messages.transportation}</th>
              <th className="px-4 py-3 font-medium">{messages.totalCost}</th>
              <th className="px-4 py-3 font-medium">{messages.view}</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{purchase.receipt_number}</td>
                <td className="px-4 py-3">
                  {purchase.suppliers?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {formatDateTime(purchase.created_at)}
                </td>
                <td className="px-4 py-3">
                  {[
                    ...new Set(
                      (purchase.purchase_items ?? [])
                        .map((item) => item.categories?.name)
                        .filter((name): name is string => Boolean(name)),
                    ),
                  ].join(", ") || messages.uncategorized}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {purchase.invoice_total_egp != null
                    ? formatEnteredPurchaseMoney(
                        purchase.invoice_currency,
                        purchase.invoice_total_sar,
                        purchase.invoice_total_egp,
                        locale,
                      )
                    : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums" dir="ltr">
                  {purchase.exchange_rate != null ? Number(purchase.exchange_rate) : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {purchase.invoice_total_egp != null
                    ? formatEnteredPurchaseMoney(
                        purchase.transport_currency,
                        purchase.transport_sar,
                        purchase.transport_egp,
                        locale,
                      )
                    : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {purchase.invoice_total_egp != null
                    ? formatPurchaseMoney(purchase.invoice_total_egp, "EGP", locale)
                    : formatMoney(Number(purchase.total_cost))}
                </td>
                <td className="px-4 py-3">
                  <ViewLink href={`/purchases/${purchase.id}`} label={messages.view} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {purchases.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{messages.noPurchases}</p>
        ) : null}
      </div>
    </AppShell>
  );
}
