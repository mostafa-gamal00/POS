export const purchaseCurrencies = ["EGP", "SAR"] as const;
export type PurchaseCurrency = (typeof purchaseCurrencies)[number];

const MONEY_SCALE = 2;
const RATE_SCALE = 6;

export type PurchaseQuoteLineInput = {
  qty: number;
  unitPrice: string;
  currency: PurchaseCurrency;
};

export type PurchaseQuoteInput = {
  invoiceTotalSar: string;
  exchangeRate: string;
  transportSar: string;
  lines: PurchaseQuoteLineInput[];
};

export type PurchaseQuoteLine = {
  qty: number;
  currency: PurchaseCurrency;
  unitPrice: string;
  goodsUnitCents: number | null;
  goodsLineCents: number | null;
  transportCents: number | null;
  transportPerUnitCents: number | null;
  extraCents: number;
  unitCostCents: number | null;
  lineTotalCents: number | null;
};

export type PurchaseQuote = {
  isComplete: boolean;
  isBalanced: boolean;
  hasRate: boolean;
  invoiceKnown: boolean;
  transportKnown: boolean;
  goodsKnown: boolean;
  invoiceTotalEgpCents: number;
  transportEgpCents: number;
  goodsEgpCents: number;
  paidEgpCents: number;
  gapCents: number;
  invoiceTotalSar: string;
  exchangeRate: string;
  transportSar: string;
  lines: PurchaseQuoteLine[];
};

function parseScaled(raw: string, scale: number, emptyAsZero: boolean): bigint | null {
  const text = raw.trim();
  if (text === "") {
    return emptyAsZero ? BigInt(0) : null;
  }
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

function multiplyToCents(amount: bigint, amountScale: number, rate: bigint): bigint | null {
  const product = amount * rate;
  const divisor = BigInt(10) ** BigInt(RATE_SCALE + amountScale - MONEY_SCALE);
  const quotient = product / divisor;
  const remainder = product % divisor;
  const rounded = remainder * BigInt(2) >= divisor ? quotient + BigInt(1) : quotient;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return rounded;
}

function asCents(value: bigint | null): number | null {
  if (value === null || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(value);
}

export function quotePurchaseInvoice(input: PurchaseQuoteInput): PurchaseQuote {
  const invoiceSar = parseScaled(input.invoiceTotalSar, MONEY_SCALE, true);
  const transportSar = parseScaled(input.transportSar, MONEY_SCALE, true);
  const rate = parseScaled(input.exchangeRate, RATE_SCALE, false);
  const hasRate = rate !== null && rate > BigInt(0);
  const headerReady =
    invoiceSar !== null &&
    transportSar !== null &&
    invoiceSar >= BigInt(0) &&
    transportSar >= BigInt(0);
  const invoiceEgp = headerReady && hasRate && rate ? multiplyToCents(invoiceSar, MONEY_SCALE, rate) : null;
  const transportEgp =
    headerReady && hasRate && rate ? multiplyToCents(transportSar, MONEY_SCALE, rate) : null;
  const parsedLines = input.lines.map((line) => {
    const qty = Number.isInteger(line.qty) && line.qty > 0 ? line.qty : null;
    const price = parseScaled(line.unitPrice, MONEY_SCALE, false);
    const currency = purchaseCurrencies.includes(line.currency) ? line.currency : null;
    return { qty, price, currency, raw: line };
  });
  const linesReady = parsedLines.every(
    (line) =>
      line.qty !== null && line.price !== null && line.price >= BigInt(0) && line.currency !== null,
  );
  const goodsUnits = parsedLines.map((line) => {
    if (line.qty === null || line.price === null || line.currency === null) {
      return null;
    }
    if (line.currency === "EGP") {
      return line.price;
    }
    if (!hasRate || !rate) {
      return null;
    }
    return multiplyToCents(line.price, MONEY_SCALE, rate);
  });
  let goodsEgp: bigint | null = input.lines.length > 0 ? BigInt(0) : null;
  for (let index = 0; index < parsedLines.length; index += 1) {
    const line = parsedLines[index];
    const unit = goodsUnits[index];
    if (goodsEgp === null || !line || unit === null || line.qty === null) {
      goodsEgp = null;
      break;
    }
    goodsEgp += unit * BigInt(line.qty);
  }
  const totalQty = linesReady
    ? parsedLines.reduce((sum, line) => sum + (line.qty ?? 0), 0)
    : 0;
  const canSplit = transportEgp !== null && totalQty > 0;
  const base = canSplit && transportEgp !== null ? transportEgp / BigInt(totalQty) : null;
  const remainder =
    canSplit && transportEgp !== null && base !== null
      ? transportEgp - base * BigInt(totalQty)
      : null;
  const lines: PurchaseQuoteLine[] = parsedLines.map((line, index) => {
    const isLast = index === parsedLines.length - 1;
    const goodsUnit = goodsUnits[index];
    const goodsLine =
      goodsUnit !== null && line.qty !== null ? goodsUnit * BigInt(line.qty) : null;
    const extra = isLast && remainder !== null ? remainder : BigInt(0);
    const lineTransport =
      base !== null && line.qty !== null ? base * BigInt(line.qty) + extra : null;
    const includeRemainderInUnit = isLast && line.qty === 1;
    const unitCost =
      goodsUnit !== null && base !== null
        ? goodsUnit + base + (includeRemainderInUnit ? extra : BigInt(0))
        : null;
    const lineTotal =
      goodsLine !== null && lineTransport !== null ? goodsLine + lineTransport : null;
    return {
      qty: line.qty ?? 0,
      currency: line.currency ?? "EGP",
      unitPrice: line.price === null ? "" : scaledToDecimal(line.price, MONEY_SCALE),
      goodsUnitCents: asCents(goodsUnit),
      goodsLineCents: asCents(goodsLine),
      transportCents: asCents(lineTransport),
      transportPerUnitCents: asCents(base),
      extraCents: Number(extra),
      unitCostCents: asCents(unitCost),
      lineTotalCents: asCents(lineTotal),
    };
  });
  const invoiceCents = asCents(invoiceEgp) ?? 0;
  const transportCents = asCents(transportEgp) ?? 0;
  const goodsCents = asCents(goodsEgp) ?? 0;
  const paidCents = goodsCents + transportCents;
  const gapCents = invoiceCents - paidCents;
  const isComplete =
    headerReady &&
    hasRate &&
    linesReady &&
    input.lines.length > 0 &&
    invoiceEgp !== null &&
    transportEgp !== null &&
    goodsEgp !== null;
  return {
    isComplete,
    isBalanced: isComplete && gapCents === 0,
    hasRate,
    invoiceKnown: invoiceEgp !== null,
    transportKnown: transportEgp !== null,
    goodsKnown: goodsEgp !== null,
    invoiceTotalEgpCents: invoiceCents,
    transportEgpCents: transportCents,
    goodsEgpCents: goodsCents,
    paidEgpCents: paidCents,
    gapCents,
    invoiceTotalSar: invoiceSar === null ? "" : scaledToDecimal(invoiceSar, MONEY_SCALE),
    exchangeRate: rate === null ? "" : scaledToDecimal(rate, RATE_SCALE),
    transportSar: transportSar === null ? "" : scaledToDecimal(transportSar, MONEY_SCALE),
    lines,
  };
}
