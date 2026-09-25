"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { fill } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import type { Category, Product } from "@/types/database";

type ProductFormProps = {
  product?: Product | null;
  canManage: boolean;
  categories: Category[];
};

export function ProductForm({ product, canManage, categories }: ProductFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [price, setPrice] = useState(String(product?.price ?? "0"));
  const [cost, setCost] = useState(String(product?.cost ?? ""));
  const [stockQty, setStockQty] = useState(String(product?.stock_qty ?? "0"));
  const [threshold, setThreshold] = useState(
    String(product?.low_stock_threshold ?? "5"),
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) {
      return;
    }
    if (!categoryId) {
      setError(messages.category);
      setIsSaving(false);
      return;
    }
    setIsSaving(true);
    setError(null);
    const supabase = createClient();
    let imagePath = product?.image_path ?? null;
    let imageUrl = product?.image_url ?? null;
    if (imageFile) {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(imageFile.type)) {
        setError(messages.imageTypeError);
        setIsSaving(false);
        return;
      }
      if (imageFile.size > 1_000_000) {
        setError(messages.imageSizeError);
        setIsSaving(false);
        return;
      }
      const extension = imageFile.name.split(".").pop() ?? "jpg";
      const path = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, imageFile, { upsert: false });
      if (uploadError) {
        setError(uploadError.message);
        setIsSaving(false);
        return;
      }
      const { data: publicData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      imagePath = path;
      imageUrl = publicData.publicUrl;
    }
    const payload = {
      category_id: categoryId,
      name: name.trim(),
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      price: Number(price),
      cost: cost === "" ? null : Number(cost),
      stock_qty: product ? product.stock_qty : Number(stockQty),
      low_stock_threshold: Number(threshold),
      is_active: isActive,
      image_path: imagePath,
      image_url: imageUrl,
    };
    if (product) {
      const { error: updateError } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id);
      if (updateError) {
        setError(updateError.message);
        setIsSaving(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("products")
        .insert(payload);
      if (insertError) {
        setError(insertError.message);
        setIsSaving(false);
        return;
      }
    }
    setIsSaving(false);
    router.push("/products");
    router.refresh();
  }
  if (!canManage && !product) {
    return <p className="text-sm text-slate-500">{messages.cannotManageProducts}</p>;
  }
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.category}</span>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          disabled={!canManage}
        >
          {product ? (
            <option value="">{messages.uncategorized}</option>
          ) : null}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.name}</span>
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={!canManage}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.sku}</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            disabled={!canManage}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.barcode}</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            disabled={!canManage}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.price}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            disabled={!canManage}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.cost}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            disabled={!canManage}
          />
        </label>
      </div>
      {!product ? (
        <label className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.openingStock}</span>
          <input
            type="number"
            min="0"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            disabled={!canManage}
          />
        </label>
      ) : (
        <p className="text-sm text-slate-600">
          {fill(messages.currentStock, { count: product.stock_qty })}
        </p>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.lowStockThreshold}</span>
        <input
          type="number"
          min="0"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          disabled={!canManage}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          disabled={!canManage}
        />
        {messages.active}
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{messages.image}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          disabled={!canManage}
        />
        {product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="mt-2 h-24 w-24 rounded object-cover"
          />
        ) : null}
      </label>
      {error ? (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {canManage ? (
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isSaving
            ? messages.saving
            : product
              ? messages.updateProduct
              : messages.createProduct}
        </button>
      ) : null}
    </form>
  );
}
