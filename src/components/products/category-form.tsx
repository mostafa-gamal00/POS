"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types/database";

export function CategoryForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const messages = useMessages();
  const [name, setName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase
      .from("categories")
      .insert({ name: name.trim() });
    setIsSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    router.refresh();
  }
  async function rename(category: Category) {
    const nextName = (drafts[category.id] ?? category.name).trim();
    if (!nextName || nextName === category.name) {
      return;
    }
    setError(null);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("categories")
      .update({ name: nextName })
      .eq("id", category.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }
  async function remove(category: Category) {
    setError(null);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("categories")
      .delete()
      .eq("id", category.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }
  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">{messages.categoryName}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md border border-teal-800 px-3 py-2 text-sm font-medium text-teal-900"
        >
          {isSaving ? messages.saving : messages.addCategory}
        </button>
      </form>
      {categories.length > 0 ? (
        <ul className="space-y-2">
          {categories.map((category) => (
            <li key={category.id} className="flex flex-wrap items-center gap-2">
              <input
                value={drafts[category.id] ?? category.name}
                onChange={(e) =>
                  setDrafts((current) => ({
                    ...current,
                    [category.id]: e.target.value,
                  }))
                }
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => rename(category)}
                className="text-sm text-teal-900 underline"
              >
                {messages.rename}
              </button>
              <button
                type="button"
                onClick={() => remove(category)}
                className="text-sm text-red-700 underline"
              >
                {messages.removeCategory}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
