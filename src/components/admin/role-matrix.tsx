"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { Permission, Role } from "@/types/database";

type RoleMatrixProps = {
  roles: Role[];
  permissions: Permission[];
  rolePermissionMap: Record<string, string[]>;
  isSuperAdmin: boolean;
};

export function RoleMatrix({
  roles,
  permissions,
  rolePermissionMap,
  isSuperAdmin,
}: RoleMatrixProps) {
  const messages = useMessages();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function togglePermission(
    roleId: string,
    permissionId: string,
    isAssigned: boolean,
  ) {
    if (!isSuperAdmin) {
      setError(messages.onlySuperAdminMatrix);
      return;
    }
    setError(null);
    const supabase = createClient();
    if (isAssigned) {
      const { error: deleteError } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("permission_id", permissionId);
      if (deleteError) {
        setError(deleteError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("role_permissions")
        .insert({ role_id: roleId, permission_id: permissionId });
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }
    setMessage(messages.matrixUpdated);
    router.refresh();
  }
  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSuperAdmin) {
      setError(messages.onlySuperAdminCreateRole);
      return;
    }
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("roles").insert({
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
      is_system: false,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCode("");
    setName("");
    setDescription("");
    setMessage(messages.roleCreated);
    router.refresh();
  }
  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {isSuperAdmin ? (
        <form
          onSubmit={createRole}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
        >
          <input
            placeholder="code (e.g. manager)"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <input
            placeholder="Name"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder={messages.description}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Add role
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          {messages.rolesAdminOnly}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">{messages.permission}</th>
              {roles.map((role) => (
                <th key={role.id} className="px-3 py-2 font-medium">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-800">{permission.name}</p>
                  <p className="text-slate-500">{permission.code}</p>
                </td>
                {roles.map((role) => {
                  const assigned = (
                    rolePermissionMap[role.id] ?? []
                  ).includes(permission.id);
                  return (
                    <td key={role.id} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={assigned}
                        disabled={!isSuperAdmin}
                        onChange={() =>
                          togglePermission(role.id, permission.id, assigned)
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
