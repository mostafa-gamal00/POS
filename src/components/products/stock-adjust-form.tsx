"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { fill } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types/database";

type StockAdjustFormProps = {
  products: Product[];
};

export function StockAdjustForm({ products }: StockAdjustFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [changeQty, setChangeQty] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("adjust_stock", {
      p_product_id: productId,
      p_change_qty: Number(changeQty),
      p_note: note || null,
    });
    setIsSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMessage(messages.stockUpdated);
    router.refresh();
  }
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.product}</span>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          required
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {fill(messages.stockOption, {
                name: product.name,
                count: product.stock_qty,
              })}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">
          {messages.changeQty}
        </span>
        <input
          type="number"
          value={changeQty}
          onChange={(e) => setChangeQty(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.note}</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
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
        disabled={isSaving || products.length === 0}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? messages.saving : messages.adjustStock}
      </button>
    </form>
  );
}
