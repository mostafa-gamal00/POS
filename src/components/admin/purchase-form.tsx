"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMessages } from "@/components/i18n/locale-provider";
import { fill, type Locale } from "@/lib/i18n";
import { filterProducts, resolveProductChoice } from "@/lib/product-search";
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
  productQuery: string;
  categoryId: string;
  qty: string;
  unitPrice: string;
  currency: PurchaseCurrency;
  serial: string;
};

const fieldClass =
  "w-full rounded-lg border-2 border-stone-950 bg-white px-3 py-3 text-base text-stone-950 outline-none focus:border-teal-800 focus:ring-2 focus:ring-teal-800/30";

function blankLine(product?: Product): Line {
  return {
    productId: product?.id ?? "",
    productQuery: product?.name ?? "",
    categoryId: product?.category_id ?? "",
    qty: "1",
    unitPrice: "",
    currency: "EGP",
    serial: "",
  };
}

function CurrencyChoice({
  value,
  onChange,
  egpLabel,
  sarLabel,
}: {
  value: PurchaseCurrency;
  onChange: (currency: PurchaseCurrency) => void;
  egpLabel: string;
  sarLabel: string;
}) {
  return (
    <div className="grid grid-cols-2 rounded-lg border-2 border-stone-950 p-1" role="group">
      {(["EGP", "SAR"] as const).map((currency) => {
        const selected = value === currency;
        return (
          <button
            key={currency}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(currency)}
            className={
              selected
                ? "rounded-md bg-stone-950 py-3 text-base font-semibold text-white"
                : "rounded-md py-3 text-base font-medium text-stone-950"
            }
          >
            {currency === "EGP" ? egpLabel : sarLabel}
          </button>
        );
      })}
    </div>
  );
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
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState<PurchaseCurrency>("EGP");
  const [exchangeRate, setExchangeRate] = useState("");
  const [transport, setTransport] = useState("0");
  const [transportCurrency, setTransportCurrency] = useState<PurchaseCurrency>("EGP");
  const [lines, setLines] = useState<Line[]>([blankLine(products[0])]);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isTest, setIsTest] = useState(false);
  const quote = useMemo(
    () =>
      quotePurchaseInvoice({
        invoiceTotal,
        invoiceCurrency,
        exchangeRate,
        transport,
        transportCurrency,
        lines: lines.map((line) => ({
          qty: Number(line.qty),
          unitPrice: line.unitPrice,
          currency: line.currency,
        })),
      }),
    [exchangeRate, invoiceCurrency, invoiceTotal, lines, transport, transportCurrency],
  );
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
  async function ensureLineProducts(
    supabase: ReturnType<typeof createClient>,
  ): Promise<string[]> {
    const ids: string[] = [];
    const known = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
    }));
    for (const line of lines) {
      const choice = resolveProductChoice(known, line.productId, line.productQuery);
      if (choice.kind === "missing") {
        throw new Error(messages.product);
      }
      if (choice.kind === "existing") {
        ids.push(choice.id);
        continue;
      }
      if (!line.categoryId) {
        throw new Error(messages.categoryRequired);
      }
      const { data, error: insertError } = await supabase
        .from("products")
        .insert({
          name: choice.name,
          category_id: line.categoryId,
          price: 0,
          stock_qty: 0,
          serial: line.serial.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (insertError || !data) {
        throw new Error(insertError?.message ?? messages.purchaseSaveFailed);
      }
      const createdId = String(data.id);
      known.push({
        id: createdId,
        name: choice.name,
        sku: null,
        barcode: null,
      });
      ids.push(createdId);
    }
    return ids;
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote.isBalanced) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const serials = lines
        .map((line) => line.serial.trim().toLowerCase())
        .filter((serial) => serial.length > 0);
      if (new Set(serials).size !== serials.length) {
        setError(messages.duplicateSerial);
        setIsSaving(false);
        return;
      }
      const resolvedSupplierId = await ensureSupplier();
      const supabase = createClient();
      const productIds = await ensureLineProducts(supabase);
      const { data, error: rpcError } = await supabase.rpc("create_purchase", {
        p_supplier_id: resolvedSupplierId,
        p_notes: notes || null,
        p_invoice_total: quote.invoiceTotal,
        p_invoice_currency: quote.invoiceCurrency,
        p_exchange_rate: quote.needsRate ? quote.exchangeRate : "",
        p_transport: quote.transport,
        p_transport_currency: quote.transportCurrency,
        p_items: lines.map((line, index) => ({
          product_id: productIds[index],
          category_id: line.categoryId || null,
          qty: Number(line.qty),
          unit_price: quote.lines[index]?.unitPrice ?? line.unitPrice,
          currency: line.currency,
          serial: line.serial.trim(),
        })),
      });
      if (rpcError) {
        setError(rpcError.message);
        setIsSaving(false);
        return;
      }
      const result = data as PurchaseRpcResult;
      if (isTest) {
        const { error: testError } = await supabase.rpc("set_purchase_test", {
          p_id: result.id,
          p_is_test: true,
        });
        if (testError) {
          setError(testError.message);
          setIsSaving(false);
          return;
        }
      }
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
      <section className="space-y-4 rounded-2xl border-4 border-teal-900 bg-white p-5">
        <h3 className="text-xl font-semibold text-stone-950">{messages.invoiceSection}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-base">
            <span className="mb-1 block font-semibold text-stone-950">{messages.supplier}</span>
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
            <label className="block text-base">
              <span className="mb-1 block font-semibold text-stone-950">{messages.newSupplierName}</span>
              <input
                className={fieldClass}
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                required
              />
            </label>
          ) : null}
          <div className="block text-base">
            <span className="mb-1 block font-semibold text-stone-950">{messages.invoiceTotal}</span>
            <CurrencyChoice
              value={invoiceCurrency}
              onChange={setInvoiceCurrency}
              egpLabel={messages.currencyEgp}
              sarLabel={messages.currencySar}
            />
            <input
              dir="ltr"
              inputMode="decimal"
              className={`${fieldClass} mt-2 tabular-nums`}
              value={invoiceTotal}
              onChange={(e) => setInvoiceTotal(e.target.value)}
              required
            />
            {invoiceCurrency === "SAR" ? (
              <span className="mt-1 block text-sm font-medium text-stone-800">
                {quote.invoiceKnown
                  ? fill(messages.equalsAmount, {
                      amount: formatPurchaseCents(quote.invoiceTotalEgpCents, "EGP", locale),
                    })
                  : messages.exchangeRateHint}
              </span>
            ) : null}
          </div>
          {quote.needsRate ? (
            <label className="block text-base">
              <span className="mb-1 block font-semibold text-stone-950">{messages.exchangeRate}</span>
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
                <span className="mt-1 block text-sm font-medium text-stone-800" dir="ltr">
                  {`1 ${messages.currencySar} = ${quote.exchangeRate} ${messages.currencyEgp}`}
                </span>
              ) : (
                <span className="mt-1 block text-sm font-medium text-stone-800">
                  {messages.exchangeRateHint}
                </span>
              )}
            </label>
          ) : null}
          <div className="block text-base sm:col-span-2">
            <span className="mb-1 block font-semibold text-stone-950">{messages.transportation}</span>
            <CurrencyChoice
              value={transportCurrency}
              onChange={setTransportCurrency}
              egpLabel={messages.currencyEgp}
              sarLabel={messages.currencySar}
            />
            <input
              dir="ltr"
              inputMode="decimal"
              className={`${fieldClass} mt-2 tabular-nums`}
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              required
            />
            {transportCurrency === "SAR" ? (
              <span className="mt-1 block text-sm font-medium text-stone-800">
                {quote.transportKnown
                  ? fill(messages.equalsAmount, {
                      amount: formatPurchaseCents(quote.transportEgpCents, "EGP", locale),
                    })
                  : messages.exchangeRateHint}
              </span>
            ) : null}
          </div>
        </div>
        <label className="flex items-center gap-2 text-base font-semibold text-stone-950">
          <input
            type="checkbox"
            checked={isTest}
            onChange={(e) => setIsTest(e.target.checked)}
          />
          {messages.testRecord}
        </label>
        <label className="block text-base">
          <span className="mb-1 block font-semibold text-stone-950">{messages.notes}</span>
          <textarea
            className={fieldClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
      </section>
      <section className="space-y-3 rounded-2xl border-4 border-amber-700 bg-white p-5">
        <h3 className="text-xl font-semibold text-stone-950">{messages.productsSection}</h3>
        {products.length === 0 ? (
          <p className="text-base font-medium text-stone-950">{messages.noProducts}</p>
        ) : null}
        {lines.map((line, index) => {
          const quoted = quote.lines[index];
          const hint = quoted ? transportHint(quoted) : null;
          return (
            <div key={index} className="space-y-3 rounded-xl border-2 border-stone-950 p-4">
              <div className="block text-base">
                <span className="mb-1 block font-semibold text-stone-950">{messages.product}</span>
                <input
                  className={fieldClass}
                  value={line.productQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    const selected = products.find((item) => item.id === line.productId);
                    updateLine(index, {
                      productQuery: value,
                      productId: selected && value === selected.name ? line.productId : "",
                    });
                  }}
                  placeholder={messages.searchProducts}
                  required
                />
                {line.productQuery.trim() &&
                line.productQuery !== products.find((item) => item.id === line.productId)?.name ? (
                  <div className="mt-2 overflow-hidden rounded-lg border-2 border-stone-950">
                    {filterProducts(products, line.productQuery).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="block w-full border-b-2 border-stone-950 px-3 py-3 text-start text-base font-medium text-stone-950 last:border-b-0 hover:bg-stone-100"
                        onClick={() =>
                          updateLine(index, {
                            productId: product.id,
                            productQuery: product.name,
                            categoryId: product.category_id ?? "",
                          })
                        }
                      >
                        {product.name}
                      </button>
                    ))}
                    {resolveProductChoice(products, "", line.productQuery).kind === "create" ? (
                      <p className="border-t-2 border-stone-950 px-3 py-3 text-base font-semibold text-stone-950">
                        {messages.createProduct}: {line.productQuery.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <label className="block text-base">
                <span className="mb-1 block font-semibold text-stone-950">{messages.category}</span>
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
                <label className="block text-base">
                  <span className="mb-1 block font-semibold text-stone-950">{messages.qty}</span>
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
                <label className="block text-base">
                  <span className="mb-1 block font-semibold text-stone-950">{messages.serial}</span>
                  <input
                    className={fieldClass}
                    value={line.serial}
                    onChange={(e) => updateLine(index, { serial: e.target.value })}
                  />
                </label>
                <label className="block text-base">
                  <span className="mb-1 block font-semibold text-stone-950">{messages.unitPrice}</span>
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
              <div className="text-base">
                <span className="mb-1 block font-semibold text-stone-950">{messages.currency}</span>
                <CurrencyChoice
                  value={line.currency}
                  onChange={(currency) => updateLine(index, { currency })}
                  egpLabel={messages.currencyEgp}
                  sarLabel={messages.currencySar}
                />
              </div>
              <div className="grid gap-2 rounded-lg border-2 border-stone-950 bg-white p-3 text-base sm:grid-cols-3">
                <div>
                  <p className="font-semibold text-stone-950">{messages.goodsTotal}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {moneyOrDash(quoted?.goodsLineCents ?? null, "EGP", locale)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-stone-950">{messages.finalUnitCost}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {moneyOrDash(quoted?.unitCostCents ?? null, "EGP", locale)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-stone-950">{messages.lineTotal}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {moneyOrDash(quoted?.lineTotalCents ?? null, "EGP", locale)}
                  </p>
                </div>
              </div>
              {hint ? (
                <p className="rounded-lg border-2 border-amber-800 bg-white px-3 py-2 text-base font-medium text-stone-950">
                  {hint}
                </p>
              ) : null}
              <button
                type="button"
                className="text-base font-semibold text-red-800"
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
          className="text-base font-semibold text-stone-950 underline"
          onClick={() => setLines((current) => [...current, blankLine(products[0])])}
        >
          {messages.addLine}
        </button>
      </section>
      <section className="space-y-3 rounded-2xl border-4 border-stone-950 bg-white p-5">
        <h3 className="text-xl font-semibold text-stone-950">{messages.balanceSection}</h3>
        <dl className="space-y-1 text-base">
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-stone-950">{messages.goodsTotal}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {quote.goodsKnown
                ? formatPurchaseCents(quote.goodsEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-stone-950">{messages.transportation}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {quote.transportKnown
                ? formatPurchaseCents(quote.transportEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="font-semibold text-stone-950">{messages.paidTotal}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {quote.goodsKnown && quote.transportKnown
                ? formatPurchaseCents(quote.paidEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t-2 border-stone-950 pt-2">
            <dt className="font-semibold text-stone-950">{messages.invoiceInEgp}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {quote.invoiceKnown
                ? formatPurchaseCents(quote.invoiceTotalEgpCents, "EGP", locale)
                : "—"}
            </dd>
          </div>
        </dl>
        <p
          className={
            quote.isBalanced
              ? "text-base font-semibold text-green-800"
              : "text-base font-semibold text-red-800"
          }
        >
          {balanceMessage}
        </p>
        {error ? (
          <p className="rounded-lg border-2 border-red-800 bg-white px-3 py-2 text-base font-medium text-red-800">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={isSaving || !quote.isBalanced}
          className="w-full rounded-lg bg-stone-950 px-4 py-4 text-base font-semibold text-white disabled:opacity-50"
        >
          {isSaving ? messages.saving : messages.receiveGoods}
        </button>
      </section>
    </form>
  );
}
