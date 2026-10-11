import { format } from "date-fns";
import type { Locale } from "@/lib/i18n";
import type { PurchaseCurrency } from "@/lib/purchase-invoice";

const purchaseCurrencyLabels: Record<Locale, Record<PurchaseCurrency, string>> = {
  en: { EGP: "EGP", SAR: "SAR" },
  ar: { EGP: "ج.م", SAR: "ر.س" },
};

export function formatPurchaseMoney(
  value: number | string,
  currency: PurchaseCurrency,
  locale: Locale,
): string {
  const amount = typeof value === "string" ? Number(value) : value;
  const cents = Math.round((Number.isFinite(amount) ? amount : 0) * 100);
  return formatPurchaseCents(cents, currency, locale);
}

export function formatPurchaseCents(
  cents: number,
  currency: PurchaseCurrency,
  locale: Locale,
): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  const amount = `${negative ? "-" : ""}${whole}.${frac}`;
  const label = purchaseCurrencyLabels[locale][currency];
  return locale === "ar" ? `${amount} ${label}` : `${label} ${amount}`;
}

export function formatEnteredPurchaseMoney(
  currency: PurchaseCurrency | null,
  sarAmount: number | null,
  egpAmount: number | null,
  locale: Locale,
): string {
  const entered = currency ?? (sarAmount != null ? "SAR" : "EGP");
  if (entered === "SAR") {
    return sarAmount == null ? "—" : formatPurchaseMoney(sarAmount, "SAR", locale);
  }
  return egpAmount == null ? "—" : formatPurchaseMoney(egpAmount, "EGP", locale);
}

export function formatMoney(value: number | string): string {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateTime(value: string): string {
  return format(new Date(value), "dd MMM yyyy HH:mm");
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
