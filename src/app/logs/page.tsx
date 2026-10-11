import { AppShell } from "@/components/layout/app-shell";
import { ExportButton } from "@/components/export-button";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import type { Messages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

type ProfileName = { full_name: string | null; email: string | null };

type LogRow = {
  id: string;
  action: string;
  summary: string;
  created_at: string;
  profiles: ProfileName | ProfileName[] | null;
};

function personName(profiles: LogRow["profiles"]): string {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.full_name || profile?.email || "";
}

function actionLabel(action: string, messages: Messages): string {
  if (action === "mark_test") return messages.actionMarkTest;
  if (action === "delete_product") return messages.actionDeleteProduct;
  if (action === "delete_sale") return messages.actionDeleteSale;
  if (action === "delete_purchase") return messages.actionDeletePurchase;
  if (action === "create_admin") return messages.actionCreateAdmin;
  if (action === "change_password") return messages.actionChangePassword;
  return action;
}

export default async function LogsPage() {
  const auth = await requirePermission("dashboard.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_logs")
    .select("id, action, summary, created_at, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(500);
  const logs = (data ?? []) as unknown as LogRow[];
  return (
    <AppShell auth={auth} locale={locale} title={messages.navLogs}>
      <div className="mb-4 flex justify-end">
        <ExportButton
          label={messages.exportData}
          filename="logs.csv"
          headers={[messages.logWhen, messages.logWho, messages.logAction, messages.logSummary]}
          rows={logs.map((log) => [
            formatDateTime(log.created_at),
            personName(log.profiles),
            actionLabel(log.action, messages),
            log.summary,
          ])}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{messages.logWhen}</th>
              <th className="px-4 py-3 font-medium">{messages.logWho}</th>
              <th className="px-4 py-3 font-medium">{messages.logAction}</th>
              <th className="px-4 py-3 font-medium">{messages.logSummary}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100">
                <td className="px-4 py-3">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-3">{personName(log.profiles) || "—"}</td>
                <td className="px-4 py-3">{actionLabel(log.action, messages)}</td>
                <td className="px-4 py-3">{log.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
