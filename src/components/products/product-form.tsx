"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { fill, type Locale } from "@/lib/i18n";
import { convertProductPrice } from "@/lib/product-price";
import { createClient } from "@/lib/supabase/client";
import { formatPurchaseMoney } from "@/lib/utils";
import type { Category, Product, PurchaseCurrency } from "@/types/database";

type ProductFormProps = {
  product?: Product | null;
  canManage: boolean;
  categories: Category[];
  locale: Locale;
};

function initialCurrency(product?: Product | null): PurchaseCurrency {
  return product?.price_currency === "SAR" ? "SAR" : "EGP";
}

function initialEnteredPrice(product?: Product | null): string {
  if (!product) {
    return "0";
  }
  if (product.price_currency === "SAR") {
    return String(product.entered_price);
  }
  return String(product.price ?? "0");
}

export function ProductForm({ product, canManage, categories, locale }: ProductFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [categoryId, setCategoryId] = useState(product?.category_id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [serial, setSerial] = useState(product?.serial ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [priceCurrency, setPriceCurrency] = useState<PurchaseCurrency>(initialCurrency(product));
  const [price, setPrice] = useState(initialEnteredPrice(product));
  const [exchangeRate, setExchangeRate] = useState(
    product?.price_exchange_rate == null ? "" : String(product.price_exchange_rate),
  );
  const [cost, setCost] = useState(String(product?.cost ?? ""));
  const [stockQty, setStockQty] = useState(String(product?.stock_qty ?? "0"));
  const [threshold, setThreshold] = useState(
    String(product?.low_stock_threshold ?? "5"),
  );
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isTest, setIsTest] = useState(product?.is_test ?? false);
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
    const converted = convertProductPrice({
      currency: priceCurrency,
      enteredPrice: price,
      exchangeRate,
    });
    if (!converted) {
      setError(messages.invalidProductPrice);
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
      serial: serial.trim() || null,
      barcode: barcode.trim() || null,
      price: converted.price,
      price_currency: converted.currency,
      entered_price: converted.enteredPrice,
      price_exchange_rate: converted.exchangeRate,
      cost: cost === "" ? null : Number(cost),
      stock_qty: product ? product.stock_qty : Number(stockQty),
      low_stock_threshold: Number(threshold),
      is_active: isActive,
      is_test: isTest,
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
  const converted = convertProductPrice({
    currency: priceCurrency,
    enteredPrice: price,
    exchangeRate,
  });
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
          <span className="mb-1 block text-slate-600">{messages.serial}</span>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
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
      <div className="space-y-3">
        <div className="block text-sm">
          <span className="mb-1 block text-slate-600">{messages.currency}</span>
          <div className="grid grid-cols-2 rounded-lg border-2 border-stone-950 p-1" role="group">
            {(["EGP", "SAR"] as const).map((currency) => {
              const selected = priceCurrency === currency;
              return (
                <button
                  key={currency}
                  type="button"
                  aria-pressed={selected}
                  disabled={!canManage}
                  onClick={() => setPriceCurrency(currency)}
                  className={
                    selected
                      ? "rounded-md bg-stone-950 py-2 text-sm font-semibold text-white"
                      : "rounded-md py-2 text-sm font-medium text-stone-950"
                  }
                >
                  {currency === "EGP" ? messages.currencyEgp : messages.currencySar}
                </button>
              );
            })}
          </div>
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
          {priceCurrency === "SAR" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.exchangeRate}</span>
              <input
                type="number"
                min="0"
                step="0.000001"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                required
                disabled={!canManage}
              />
              <span className="mt-1 block text-xs text-slate-500">{messages.exchangeRateHint}</span>
            </label>
          ) : null}
        </div>
        <p className="text-sm text-slate-600">
          {messages.priceInEgp}:{" "}
          {converted ? formatPurchaseMoney(converted.price, "EGP", locale) : "—"}
        </p>
      </div>
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isTest}
          onChange={(e) => setIsTest(e.target.checked)}
          disabled={!canManage}
        />
        {messages.testRecord}
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
