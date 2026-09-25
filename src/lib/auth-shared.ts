import type { PermissionCode, Role } from "@/types/database";

export type AuthContext = {
  userId: string;
  email: string;
  fullName: string;
  isSuperAdmin: boolean;
  permissions: string[];
  roles: Role[];
};

export function hasPermission(
  context: AuthContext,
  code: PermissionCode,
): boolean {
  return context.isSuperAdmin || context.permissions.includes(code);
}
