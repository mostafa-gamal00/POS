"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ExportButton } from "@/components/export-button";
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
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminRoleIds, setAdminRoleIds] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  function toggleAdminRole(roleId: string) {
    setAdminRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
  }
  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_admin", {
      p_email: adminEmail,
      p_password: adminPassword,
      p_full_name: adminName,
      p_role_ids: adminRoleIds,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setAdminRoleIds([]);
    setMessage(messages.adminCreated);
    router.refresh();
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== repeatPassword) {
      setError(messages.passwordsDoNotMatch);
      return;
    }
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("change_super_admin_password", {
      p_new_password: newPassword,
      p_confirmation: confirmation,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNewPassword("");
    setRepeatPassword("");
    setConfirmation("");
    setMessage(messages.passwordChanged);
  }
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
      {isSuperAdmin ? (
        <form
          onSubmit={createAdmin}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="text-lg font-medium">{messages.addAdmin}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={messages.fullName}
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              required
            />
            <input
              type="email"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={messages.email}
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              required
            />
            <input
              type="password"
              minLength={8}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder={messages.password}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={adminRoleIds.includes(role.id)}
                  onChange={() => toggleAdminRole(role.id)}
                />
                {role.name}
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {messages.addAdmin}
          </button>
        </form>
      ) : null}
      {isSuperAdmin ? (
        <form
          onSubmit={changePassword}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h3 className="text-lg font-medium">{messages.changeMyPassword}</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.newPassword}</span>
              <input
                type="password"
                minLength={8}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.repeatPassword}</span>
              <input
                type="password"
                minLength={8}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.confirmation}</span>
              <input
                type="password"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {messages.changeMyPassword}
          </button>
        </form>
      ) : null}
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <ExportButton
          label={messages.exportData}
          filename="users.csv"
          headers={[messages.name, messages.email, messages.roles]}
          rows={users.map((user) => [
            user.full_name || messages.unnamed,
            user.email,
            roles
              .filter((role) => user.roleIds.includes(role.id))
              .map((role) => role.name)
              .join(", "),
          ])}
        />
      </div>
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
