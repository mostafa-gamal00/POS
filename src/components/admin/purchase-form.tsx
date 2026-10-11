"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { fill, type Locale } from "@/lib/i18n";
import {
  quotePurchaseInvoice,
  type PurchaseCurrency,
  type PurchaseQuoteLine,
} from "@/lib/purchase-invoice";
import { createClient } from "@/lib/supabase/client";
import { formatPurchaseCents } from "@/lib/utils";
import type { Category, Product, PurchaseRpcResult, Supplier } from "@/types/database";

type PurchaseFormProps = {
  products: Product[];
  suppliers: Supplier[];
  categories: Category[];
  locale: Locale;
};

type Line = {
  productId: string;
  categoryId: string;
  qty: string;
  unitPrice: string;
  currency: PurchaseCurrency;
};

const fieldClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/15";

function blankLine(product?: Product): Line {
  return {
    productId: product?.id ?? "",
    categoryId: product?.category_id ?? "",
    qty: "1",
    unitPrice: "",
    currency: "SAR",
  };
}

function moneyOrDash(
  cents: number | null,
  currency: PurchaseCurrency,
  locale: Locale,
): string {
  if (cents === null) {
    return "—";
  }
  return formatPurchaseCents(cents, currency, locale);
}

export function PurchaseForm({ products, suppliers, categories, locale }: PurchaseFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [invoiceTotalSar, setInvoiceTotalSar] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [transportSar, setTransportSar] = useState("0");
  const [lines, setLines] = useState<Line[]>([blankLine(products[0])]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const quote = useMemo(
    () =>
      quotePurchaseInvoice({
        invoiceTotalSar,
        exchangeRate,
        transportSar,
        lines: lines.map((line) => ({
          qty: Number(line.qty),
          unitPrice: line.unitPrice,
          currency: line.currency,
        })),
      }),
    [exchangeRate, invoiceTotalSar, lines, transportSar],
  );
  const productGroups = useMemo(() => {
    return products.reduce<Record<string, Product[]>>((groups, product) => {
      const key = product.categories?.name ?? messages.uncategorized;
      groups[key] = [...(groups[key] ?? []), product];
      return groups;
    }, {});
  }, [messages.uncategorized, products]);
  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }
  function transportHint(line: PurchaseQuoteLine): string | null {
    if (line.transportCents === null || line.transportPerUnitCents === null || line.qty <= 0) {
      return null;
    }
    const values = {
      amount: formatPurchaseCents(line.transportCents, "EGP", locale),
      perUnit: formatPurchaseCents(line.transportPerUnitCents, "EGP", locale),
      qty: line.qty,
    };
    if (line.extraCents > 0) {
      return fill(messages.transportHintExtra, {
        ...values,
        extra: formatPurchaseCents(line.extraCents, "EGP", locale),
      });
    }
    return fill(messages.transportHint, values);
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
    if (!quote.isBalanced) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const resolvedSupplierId = await ensureSupplier();
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("create_purchase", {
        p_supplier_id: resolvedSupplierId,
        p_notes: notes || null,
        p_invoice_total_sar: quote.invoiceTotalSar,
        p_exchange_rate: quote.exchangeRate,
        p_transport_sar: quote.transportSar,
        p_items: lines.map((line, index) => ({
          product_id: line.productId,
          category_id: line.categoryId || null,
          qty: Number(line.qty),
          unit_price: quote.lines[index]?.unitPrice ?? line.unitPrice,
          currency: line.currency,
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
  const balanceMessage = !quote.isComplete
    ? messages.saveBlockedBalance
    : quote.isBalanced
      ? messages.invoiceBalanced
      : quote.gapCents > 0
        ? fill(messages.invoiceShort, {
            amount: formatPurchaseCents(quote.gapCents, "EGP", locale),
          })
        : fill(messages.invoiceOver, {
            amount: formatPurchaseCents(Math.abs(quote.gapCents), "EGP", locale),
          });
  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-teal-950">{messages.invoiceSection}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">{messages.supplier}</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={fieldClass}
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
              <span className="mb-1 block text-stone-600">{messages.newSupplierName}</span>
              <input
                className={fieldClass}
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">
              {messages.invoiceTotal} ({messages.currencySar})
            </span>
            <input
              dir="ltr"
              inputMode="decimal"
              className={`${fieldClass} tabular-nums`}
              value={invoiceTotalSar}
              onChange={(e) => setInvoiceTotalSar(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-stone-500">
              {quote.invoiceKnown
                ? fill(messages.equalsAmount, {
                    amount: formatPurchaseCents(quote.invoiceTotalEgpCents, "EGP", locale),
                  })
                : messages.exchangeRateHint}
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-600">{messages.exchangeRate}</span>
            <input
              dir="ltr"
              inputMode="decimal"
              className={`${fieldClass} tabular-nums`}
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="13.50"
              required
            />
            {quote.hasRate ? (
              <span className="mt-1 block text-xs text-stone-500" dir="ltr">
                {`1 ${messages.currencySar} = ${quote.exchangeRate} ${messages.currencyEgp}`}
              </span>
            ) : (
              <span className="mt-1 block text-xs text-stone-500">{messages.exchangeRateHint}</span>
            )}
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-600">
              {messages.transportation} ({messages.currencySar})
            </span>
            <input
              dir="ltr"
              inputMode="decimal"
              className={`${fieldClass} tabular-nums`}
              value={transportSar}
              onChange={(e) => setTransportSar(e.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-stone-500">
              {quote.transportKnown
                ? fill(messages.equalsAmount, {
                    amount: formatPurchaseCents(quote.transportEgpCents, "EGP", locale),
                  })
                : messages.exchangeRateHint}
            </span>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-600">{messages.notes}</span>
          <textarea
            className={fieldClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
      </section>
      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-teal-950">{messages.productsSection}</h3>
        {products.length === 0 ? (
          <p className="text-sm text-stone-500">{messages.noProducts}</p>
        ) : null}
        {lines.map((line, index) => {
          const quoted = quote.lines[index];
          const hint = quoted ? transportHint(quoted) : null;
          return (
            <div key={index} className="space-y-3 rounded-xl border border-stone-200 p-4">
              <label className="block text-sm">
                <span className="mb-1 block text-stone-600">{messages.product}</span>
                <select
                  value={line.productId}
                  onChange={(e) => {
                    const product = products.find((item) => item.id === e.target.value);
                    updateLine(index, {
                      productId: e.target.value,
                      categoryId: product?.category_id ?? "",
                    });
                  }}
                  className={fieldClass}
                  required
                >
                  {Object.entries(productGroups).map(([categoryName, group]) => (
                    <optgroup key={categoryName} label={categoryName}>
                      {group.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-600">{messages.category}</span>
                <select
                  value={line.categoryId}
                  onChange={(e) => updateLine(index, { categoryId: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">{messages.uncategorized}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-600">{messages.qty}</span>
                  <input
                    dir="ltr"
                    type="number"
                    min={1}
                    step={1}
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: e.target.value })}
                    className={`${fieldClass} tabular-nums`}
                    required
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-600">{messages.unitPrice}</span>
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                    className={`${fieldClass} tabular-nums`}
                    required
                  />
                </label>
              </div>
              <div className="text-sm">
                <span className="mb-1 block text-stone-600">{messages.currency}</span>
                <div className="grid grid-cols-2 rounded-lg bg-stone-100 p-1" role="group">
                  {(["EGP", "SAR"] as const).map((currency) => {
                    const selected = line.currency === currency;
                    return (
                      <button
                        key={currency}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => updateLine(index, { currency })}
                        className={
                          selected
                            ? "rounded-md bg-white py-2 text-sm font-medium text-teal-950 shadow-sm"
                            : "rounded-md py-2 text-sm text-stone-600"
                        }
                      >
                        {currency === "EGP" ? messages.currencyEgp : messages.currencySar}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2 rounded-lg bg-stone-50 p-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-stone-500">{messages.goodsTotal}</p>
                  <p className="font-medium tabular-nums">
                    {moneyOrDash(quoted?.goodsLineCents ?? null, "EGP", locale)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">{messages.finalUnitCost}</p>
                  <p className="font-medium tabular-nums">
                    {moneyOrDash(quoted?.unitCostCents ?? null, "EGP", locale)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">{messages.lineTotal}</p>
                  <p className="font-medium tabular-nums">
                    {moneyOrDash(quoted?.lineTotalCents ?? null, "EGP", locale)}
                  </p>
                </div>
              </div>
              {hint ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">{hint}</p>
              ) : null}
              <button
                type="button"
                className="text-sm text-red-700"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                disabled={lines.length === 1}
              >
                {messages.remove}
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="text-sm font-medium text-teal-800 underline"
          onClick={() => setLines((current) => [...current, blankLine(products[0])])}
        >
          {messages.addLine}
        </button>
      </section>
      <section
        className={
          quote.isBalanced
            ? "sticky bottom-4 z-10 space-y-3 rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-md"
            : "sticky bottom-4 z-10 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-md"
        }
      >
        <h3 className="text-lg font-semibold text-teal-950">{messages.balanceSection}</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">{messages.goodsTotal}</dt>
            <dd className="tabular-nums font-medium">
              {quote.goodsKnown
                ? formatPurchaseCents(quote.goodsEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">{messages.transportation}</dt>
            <dd className="tabular-nums font-medium">
              {quote.transportKnown
                ? formatPurchaseCents(quote.transportEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">{messages.paidTotal}</dt>
            <dd className="tabular-nums font-medium">
              {quote.goodsKnown && quote.transportKnown
                ? formatPurchaseCents(quote.paidEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-stone-200 pt-2">
            <dt className="text-stone-600">{messages.invoiceInEgp}</dt>
            <dd className="tabular-nums font-semibold">
              {quote.invoiceKnown
                ? formatPurchaseCents(quote.invoiceTotalEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
        </dl>
        <p className={quote.isBalanced ? "text-sm font-medium text-teal-900" : "text-sm font-medium text-amber-950"}>
          {balanceMessage}
        </p>
        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={isSaving || products.length === 0 || !quote.isBalanced}
          className="w-full rounded-lg bg-teal-950 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? messages.saving : messages.receiveGoods}
        </button>
      </section>
    </form>
  );
}
