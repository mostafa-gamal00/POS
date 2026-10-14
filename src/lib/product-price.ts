import type { Locale } from "@/lib/i18n";
import type { PurchaseCurrency } from "@/lib/purchase-invoice";
import { formatPurchaseMoney } from "@/lib/utils";

const MONEY_SCALE = 2;
const RATE_SCALE = 6;

export type ProductPriceInput = {
  currency: PurchaseCurrency;
  enteredPrice: string;
  exchangeRate: string;
};

export type ConvertedProductPrice = {
  currency: PurchaseCurrency;
  enteredPrice: string;
  exchangeRate: string | null;
  price: string;
};

export type ProductPriceDisplay = {
  price: number | string;
  price_currency?: PurchaseCurrency | null;
  entered_price?: number | string | null;
};

function parseScaled(raw: string, scale: number): bigint | null {
  const text = raw.trim();
  const match = text.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }
  const whole = match[1] ?? "0";
  const frac = match[2] ?? "";
  if (whole.length > 10) {
    return null;
  }
  if (frac.length <= scale) {
    return BigInt(whole + frac.padEnd(scale, "0"));
  }
  const kept = frac.slice(0, scale);
  const next = frac[scale] ?? "0";
  let scaled = BigInt(whole + kept);
  if (next >= "5") {
    scaled += BigInt(1);
  }
  return scaled;
}

function scaledToDecimal(value: bigint, scale: number): string {
  const text = value.toString().padStart(scale + 1, "0");
  const whole = text.slice(0, -scale);
  const frac = text.slice(-scale).replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : whole;
}

function multiplyToCents(amount: bigint, rate: bigint): bigint | null {
  const product = amount * rate;
  const divisor = BigInt(10) ** BigInt(RATE_SCALE);
  const quotient = product / divisor;
  const remainder = product % divisor;
  const rounded = remainder * BigInt(2) >= divisor ? quotient + BigInt(1) : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return rounded;
}

export function convertProductPrice(input: ProductPriceInput): ConvertedProductPrice | null {
  if (input.currency !== "EGP" && input.currency !== "SAR") {
    return null;
  }
  const amount = parseScaled(input.enteredPrice, MONEY_SCALE);
  if (amount === null || amount < BigInt(0)) {
    return null;
  }
  const enteredPrice = scaledToDecimal(amount, MONEY_SCALE);
  if (input.currency === "EGP") {
    return {
      currency: "EGP",
      enteredPrice,
      exchangeRate: null,
      price: enteredPrice,
    };
  }
  const rate = parseScaled(input.exchangeRate, RATE_SCALE);
  if (rate === null || rate <= BigInt(0)) {
    return null;
  }
  const cents = multiplyToCents(amount, rate);
  if (cents === null) {
    return null;
  }
  return {
    currency: "SAR",
    enteredPrice,
    exchangeRate: scaledToDecimal(rate, RATE_SCALE),
    price: scaledToDecimal(cents, MONEY_SCALE),
  };
}

export function formatProductMoney(product: ProductPriceDisplay, locale: Locale): string {
  const selling = formatPurchaseMoney(product.price, "EGP", locale);
  if (product.price_currency === "SAR" && product.entered_price != null && product.entered_price !== "") {
    return `${formatPurchaseMoney(product.entered_price, "SAR", locale)} · ${selling}`;
  }
  return selling;
}
