import { AppShell } from "@/components/layout/app-shell";
import { UsersAdmin } from "@/components/admin/users-admin";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types/database";

export default async function AdminUsersPage() {
  const auth = await requirePermission("users.manage");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const [{ data: profiles }, { data: roles }, { data: userRoles }] =
    await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("roles").select("*").order("name"),
      supabase.from("user_roles").select("user_id, role_id"),
    ]);
  const users = ((profiles ?? []) as Profile[]).map((profile) => ({
    ...profile,
    roleIds: (userRoles ?? [])
      .filter((row) => row.user_id === profile.id)
      .map((row) => row.role_id as string),
  }));
  return (
    <AppShell auth={auth} locale={locale} title={messages.navUsers}>
      <UsersAdmin
        users={users}
        roles={(roles ?? []) as Role[]}
        isSuperAdmin={auth.isSuperAdmin}
      />
    </AppShell>
  );
}
