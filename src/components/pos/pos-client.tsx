"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMessages } from "@/components/i18n/locale-provider";
import { fill, type Locale } from "@/lib/i18n";
import { checkAddQty, checkCheckout } from "@/lib/stock-rules";
import { formatPurchaseMoney } from "@/lib/utils";
import type { CartItem, PaymentMethod, Product, SaleRpcResult } from "@/types/database";

type PosClientProps = {
  products: Product[];
  locale: Locale;
};

function formatMoney(value: number, locale: Locale): string {
  return formatPurchaseMoney(value, "EGP", locale);
}

export function PosClient({ products, locale }: PosClientProps) {
  const router = useRouter();
  const messages = useMessages();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [isTest, setIsTest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return products;
    }
    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(normalized) ||
        product.sku?.toLowerCase().includes(normalized) ||
        product.barcode?.toLowerCase().includes(normalized)
      );
    });
  }, [products, query]);
  const total = cart.reduce(
    (sum, item) => sum + item.soldPrice * item.qty,
    0,
  );
  function addToCart(product: Product) {
    setError(null);
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      const check = checkAddQty(existing?.qty ?? 0, product.stock_qty, product.name);
      if (!check.ok) {
        setError(check.message);
        return current;
      }
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item,
        );
      }
      return [...current, { product, qty: 1, soldPrice: Number(product.price) }];
    });
  }
  function updateQty(productId: string, qty: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId ? { ...item, qty } : item,
        )
        .filter((item) => item.qty > 0),
    );
  }
  async function checkout() {
    const check = checkCheckout(
      cart.map((item) => ({
        qty: item.qty,
        stockQty: item.product.stock_qty,
        name: item.product.name,
      })),
    );
    if (!check.ok) {
      setError(check.message);
      return;
    }
    if (cart.some((item) => !Number.isFinite(item.soldPrice) || item.soldPrice < 0)) {
      setError(messages.invalidSoldPrice);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("create_sale", {
      p_payment_method: paymentMethod,
      p_items: cart.map((item) => ({
        product_id: item.product.id,
        qty: item.qty,
        unit_price: item.soldPrice,
      })),
    });
    if (rpcError || !data) {
      setError(rpcError?.message ?? messages.saleSaveFailed);
      setIsSubmitting(false);
      return;
    }
    const result = data as SaleRpcResult;
    if (isTest) {
      const { error: testError } = await supabase.rpc("set_sale_test", {
        p_id: result.id,
        p_is_test: true,
      });
      if (testError) {
        setError(testError.message);
        setIsSubmitting(false);
        return;
      }
    }
    setIsSubmitting(false);
    setCart([]);
    router.push(`/sales/${result.id}`);
    router.refresh();
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={messages.searchProducts}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoFocus
        />
        <div className="mt-4 grid max-h-[70vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addToCart(product)}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-start hover:border-slate-400"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-slate-100">
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{product.name}</p>
                <p className="text-sm text-slate-600">
                  {formatMoney(Number(product.price), locale)} ·{" "}
                  {fill(messages.stockLabel, { count: product.stock_qty })}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-medium">{messages.cart}</h3>
        <ul className="mt-3 max-h-[45vh] space-y-3 overflow-y-auto">
          {cart.length === 0 ? (
            <li className="text-sm text-slate-500">{messages.noItems}</li>
          ) : (
            cart.map((item) => (
              <li
                key={item.product.id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.product.name}</p>
                  <label className="mt-1 block text-xs text-slate-500">
                    {messages.soldPrice}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.soldPrice}
                      onChange={(e) =>
                        setCart((current) =>
                          current.map((line) =>
                            line.product.id === item.product.id
                              ? { ...line, soldPrice: Number(e.target.value) }
                              : line,
                          ),
                        )
                      }
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </label>
                </div>
                <input
                  type="number"
                  min={1}
                  max={item.product.stock_qty}
                  value={item.qty}
                  onChange={(e) =>
                    updateQty(item.product.id, Number(e.target.value))
                  }
                  className="w-16 rounded border border-slate-300 px-2 py-1"
                />
              </li>
            ))
          )}
        </ul>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">{messages.payment}</span>
            <select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="cash">{messages.cash}</option>
              <option value="card">{messages.card}</option>
              <option value="other">{messages.other}</option>
            </select>
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
            />
            {messages.testRecord}
          </label>
          <div className="mt-4 flex items-center justify-between text-lg font-semibold">
            <span>{messages.total}</span>
            <span>{formatMoney(total, locale)}</span>
          </div>
          {error ? (
            <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={checkout}
            disabled={isSubmitting || cart.length === 0}
            className="mt-4 w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {isSubmitting ? messages.processing : messages.checkout}
          </button>
        </div>
      </section>
    </div>
  );
}
