"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Role } from "@/types/database";

type UserRow = Profile & {
  roleIds: string[];
};

type UsersAdminProps = {
  users: UserRow[];
  roles: Role[];
  isSuperAdmin: boolean;
};

export function UsersAdmin({ users, roles, isSuperAdmin }: UsersAdminProps) {
  const router = useRouter();
  const messages = useMessages();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function toggleRole(
    userId: string,
    roleId: string,
    roleCode: string,
    isAssigned: boolean,
  ) {
    setError(null);
    setMessage(null);
    if (roleCode === "super_admin" && !isSuperAdmin) {
      setError(messages.onlySuperAdminRole);
      return;
    }
    const supabase = createClient();
    if (isAssigned) {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role_id", roleId);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role_id: roleId });
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    setMessage(messages.rolesUpdated);
    router.refresh();
  }
  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{messages.user}</th>
              <th className="px-4 py-3 font-medium">{messages.roles}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{user.full_name || messages.unnamed}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const assigned = user.roleIds.includes(role.id);
                      return (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() =>
                            toggleRole(user.id, role.id, role.code, assigned)
                          }
                          className={`rounded-full px-3 py-1 text-xs ${
                            assigned
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {role.name}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Invite new users by sharing the sign-up page. First user is super admin;
        later users need a role assigned here.
      </p>
    </div>
  );
}
