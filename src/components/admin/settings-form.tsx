"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { ShopSettings } from "@/types/database";

type SettingsFormProps = {
  settings: ShopSettings;
};

export function SettingsForm({ settings }: SettingsFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [shopName, setShopName] = useState(settings.shop_name);
  const [footer, setFooter] = useState(settings.receipt_footer);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("shop_settings")
      .update({
        shop_name: shopName,
        receipt_footer: footer,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    setIsSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage(messages.settingsSaved);
    router.refresh();
  }
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.shopName}</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.receiptFooter}</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={footer}
          onChange={(e) => setFooter(e.target.value)}
          rows={3}
        />
      </label>
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {message ? (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSaving}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? messages.saving : messages.saveSettings}
      </button>
    </form>
  );
}
