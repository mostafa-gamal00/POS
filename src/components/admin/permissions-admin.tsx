"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ExportButton } from "@/components/export-button";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { Permission } from "@/types/database";

type PermissionsAdminProps = {
  permissions: Permission[];
  isSuperAdmin: boolean;
};

export function PermissionsAdmin({
  permissions,
  isSuperAdmin,
}: PermissionsAdminProps) {
  const router = useRouter();
  const messages = useMessages();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function createPermission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSuperAdmin) {
      setError(messages.onlySuperAdminPermission);
      return;
    }
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("permissions").insert({
      code: code.trim(),
      name: name.trim(),
      description: description.trim(),
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setCode("");
    setName("");
    setDescription("");
    setMessage(messages.permissionCreated);
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
          onSubmit={createPermission}
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4"
        >
          <input
            placeholder="code (e.g. reports.view)"
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
            {messages.addPermission}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-500">
          Only super admin can add permissions.
        </p>
      )}
      <div className="flex justify-end">
        <ExportButton
          label={messages.exportData}
          filename="permissions.csv"
          headers={[messages.code, messages.description]}
          rows={permissions.map((permission) => [permission.code, permission.description])}
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-start text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{messages.code}</th>
              <th className="px-4 py-3 font-medium">{messages.name}</th>
              <th className="px-4 py-3 font-medium">{messages.description}</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((permission) => (
              <tr key={permission.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{permission.code}</td>
                <td className="px-4 py-3">{permission.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {permission.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
