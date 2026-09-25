import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, type AuthContext } from "@/lib/auth-shared";
import type { PermissionCode, Role } from "@/types/database";

export { hasPermission, type AuthContext };

type AuthContextPayload = {
  full_name?: string;
  email?: string;
  is_super_admin?: boolean;
  permissions?: string[];
  roles?: Role[];
};

export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }
  const { data } = await supabase.rpc("auth_context");
  const payload = (data ?? {}) as AuthContextPayload;
  const roles = Array.isArray(payload.roles) ? payload.roles : [];
  const permissions = Array.isArray(payload.permissions)
    ? payload.permissions
    : [];
  return {
    userId: user.id,
    email: payload.email || user.email || "",
    fullName: payload.full_name ?? "",
    isSuperAdmin: Boolean(payload.is_super_admin),
    permissions,
    roles,
  };
});

export async function requireAuth(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    redirect("/login");
  }
  return context;
}

export async function requirePermission(
  code: PermissionCode,
): Promise<AuthContext> {
  const context = await requireAuth();
  if (context.isSuperAdmin) {
    return context;
  }
  if (!context.permissions.includes(code)) {
    redirect("/unauthorized");
  }
  return context;
}
