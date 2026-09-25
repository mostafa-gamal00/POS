import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PermissionsAdmin } from "@/components/admin/permissions-admin";
import { requireAuth } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Permission } from "@/types/database";

export default async function AdminPermissionsPage() {
  const auth = await requireAuth();
  const locale = await getLocale();
  const messages = await getMessages();
  if (!auth.isSuperAdmin) {
    redirect("/dashboard");
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("permissions")
    .select("*")
    .order("code");
  return (
    <AppShell auth={auth} locale={locale} title={messages.navPermissions}>
      <PermissionsAdmin
        permissions={(data ?? []) as Permission[]}
        isSuperAdmin={auth.isSuperAdmin}
      />
    </AppShell>
  );
}
