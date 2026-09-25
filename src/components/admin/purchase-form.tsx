"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { Category, Product, PurchaseRpcResult, Supplier } from "@/types/database";

type PurchaseFormProps = {
  products: Product[];
  suppliers: Supplier[];
  categories: Category[];
};

type Line = {
  productId: string;
  categoryId: string;
  qty: number;
  unitCost: number;
};

export function PurchaseForm({ products, suppliers, categories }: PurchaseFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([
    {
      productId: products[0]?.id ?? "",
      categoryId: products[0]?.category_id ?? "",
      qty: 1,
      unitCost: 0,
    },
  ]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0),
    [lines],
  );
  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }
  async function ensureSupplier(): Promise<string | null> {
    if (supplierId) {
      return supplierId;
    }
    if (!newSupplierName.trim()) {
      return null;
    }
    const supabase = createClient();
    const { data, error: insertError } = await supabase
      .from("suppliers")
      .insert({ name: newSupplierName.trim() })
      .select("id")
      .single();
    if (insertError) {
      throw new Error(insertError.message);
    }
    return data.id as string;
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const resolvedSupplierId = await ensureSupplier();
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_purchase", {
        p_supplier_id: resolvedSupplierId,
        p_notes: notes || null,
        p_items: lines.map((line) => ({
          product_id: line.productId,
          category_id: line.categoryId || null,
          qty: line.qty,
          unit_cost: line.unitCost,
        })),
      });
      if (rpcError) {
        setError(rpcError.message);
        setIsSaving(false);
        return;
      }
      const result = data as PurchaseRpcResult;
      router.push(`/purchases/${result.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.purchaseSaveFailed);
      setIsSaving(false);
    }
  }
  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.supplier}</span>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">{messages.newSupplier}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        {!supplierId ? (
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">{messages.newSupplierName}</span>
            <input
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              required
            />
          </label>
        ) : null}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.notes}</span>
        <textarea
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>
      <div className="space-y-3">
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-md border border-slate-100 p-3 md:grid-cols-2"
          >
            <select
              value={line.productId}
              onChange={(e) => {
                const product = products.find((item) => item.id === e.target.value);
                updateLine(index, {
                  productId: e.target.value,
                  categoryId: product?.category_id ?? "",
                });
              }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            >
              {Object.entries(
                products.reduce<Record<string, typeof products>>((groups, product) => {
                  const key = product.categories?.name ?? messages.uncategorized;
                  groups[key] = [...(groups[key] ?? []), product];
                  return groups;
                }, {}),
              ).map(([categoryName, group]) => (
                <optgroup key={categoryName} label={categoryName}>
                  {group.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.category}</span>
              <select
                value={line.categoryId}
                onChange={(e) => updateLine(index, { categoryId: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">{messages.uncategorized}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.qty}</span>
              <input
                type="number"
                min={1}
                value={line.qty}
                onChange={(e) =>
                  updateLine(index, { qty: Number(e.target.value) })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.unitCost}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={line.unitCost}
                onChange={(e) =>
                  updateLine(index, { unitCost: Number(e.target.value) })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </label>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() =>
                setLines((current) => current.filter((_, i) => i !== index))
              }
              disabled={lines.length === 1}
            >
              {messages.remove}
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="text-sm text-slate-700 underline"
        onClick={() =>
          setLines((current) => [
            ...current,
            {
              productId: products[0]?.id ?? "",
              categoryId: products[0]?.category_id ?? "",
              qty: 1,
              unitCost: 0,
            },
          ])
        }
      >
        {messages.addLine}
      </button>
      <p className="text-lg font-semibold">
        {messages.totalCost}:{" "}
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(total)}
      </p>
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={isSaving || products.length === 0}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSaving ? messages.saving : messages.receiveGoods}
      </button>
    </form>
  );
}
