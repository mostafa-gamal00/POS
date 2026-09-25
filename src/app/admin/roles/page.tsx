import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RoleMatrix } from "@/components/admin/role-matrix";
import { requireAuth } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Permission, Role } from "@/types/database";

export default async function AdminRolesPage() {
  const auth = await requireAuth();
  const locale = await getLocale();
  const messages = await getMessages();
  if (!auth.isSuperAdmin) {
    redirect("/dashboard");
  }
  const supabase = await createClient();
  const [{ data: roles }, { data: permissions }, { data: rolePermissions }] =
    await Promise.all([
      supabase.from("roles").select("*").order("name"),
      supabase.from("permissions").select("*").order("code"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
  const rolePermissionMap: Record<string, string[]> = {};
  for (const row of rolePermissions ?? []) {
    const roleId = row.role_id as string;
    const permissionId = row.permission_id as string;
    rolePermissionMap[roleId] = [
      ...(rolePermissionMap[roleId] ?? []),
      permissionId,
    ];
  }
  return (
    <AppShell auth={auth} locale={locale} title={messages.navRoles}>
      <RoleMatrix
        roles={(roles ?? []) as Role[]}
        permissions={(permissions ?? []) as Permission[]}
        rolePermissionMap={rolePermissionMap}
        isSuperAdmin={auth.isSuperAdmin}
      />
    </AppShell>
  );
}
