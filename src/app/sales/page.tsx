import { ExportButton } from "@/components/export-button";
import { AppShell } from "@/components/layout/app-shell";
import { ViewLink } from "@/components/products/view-link";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/utils";
import type { Sale } from "@/types/database";

export default async function SalesPage() {
  const auth = await requirePermission("sales.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10000);
  const allSales = (data ?? []) as Sale[];
  const sales = allSales.slice(0, 100);
  return (
    <AppShell auth={auth} locale={locale} title={messages.navSales}>
      <div className="mb-4 flex justify-end">
        <ExportButton
          label={messages.exportData}
          filename="sales.csv"
          headers={[messages.receipt, messages.date, messages.payment, messages.total]}
          rows={allSales.map((sale) => [
            sale.receipt_number,
            formatDateTime(sale.created_at),
            messages[sale.payment_method],
            formatMoney(Number(sale.total_amount)),
          ])}
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{messages.receipt}</th>
              <th className="px-4 py-3 font-medium">{messages.date}</th>
              <th className="px-4 py-3 font-medium">{messages.payment}</th>
              <th className="px-4 py-3 font-medium">{messages.total}</th>
              <th className="px-4 py-3 font-medium">{messages.view}</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{sale.receipt_number}</td>
                <td className="px-4 py-3">{formatDateTime(sale.created_at)}</td>
                <td className="px-4 py-3">
                  {messages[sale.payment_method]}
                </td>
                <td className="px-4 py-3">
                  {formatMoney(Number(sale.total_amount))}
                </td>
                <td className="px-4 py-3">
                  <ViewLink href={`/sales/${sale.id}`} label={messages.view} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sales.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">{messages.noSales}</p>
        ) : null}
      </div>
    </AppShell>
  );
}
