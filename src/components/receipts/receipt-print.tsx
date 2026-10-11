"use client";

import { useMessages } from "@/components/i18n/locale-provider";
import type { Locale } from "@/lib/i18n";
import { formatPurchaseMoney } from "@/lib/utils";

type ReceiptLine = {
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  detailLines?: string[];
};

type ReceiptPrintProps = {
  title: string;
  shopName: string;
  receiptNumber: string;
  createdAt: string;
  footer: string;
  lines: ReceiptLine[];
  priceLabel?: string;
  totalLabel: string;
  totalAmount: number;
  amountCurrency?: "USD" | "EGP";
  locale?: Locale;
  meta?: Array<{ label: string; value: string }>;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function ReceiptPrint({
  title,
  shopName,
  receiptNumber,
  createdAt,
  footer,
  lines,
  priceLabel,
  totalLabel,
  totalAmount,
  amountCurrency = "USD",
  locale = "en",
  meta = [],
}: ReceiptPrintProps) {
  const messages = useMessages();
  function amount(value: number): string {
    if (amountCurrency === "EGP") {
      return formatPurchaseMoney(value, "EGP", locale);
    }
    return formatMoney(value);
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="print:hidden mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {messages.printReceipt}
        </button>
      </div>
      <div className="mx-auto max-w-md text-slate-900">
        <div className="text-center">
          <p className="text-lg font-semibold">{shopName}</p>
          <p className="mt-1 text-sm text-slate-600">{title}</p>
          <p className="mt-2 font-mono text-sm">{receiptNumber}</p>
          <p className="text-xs text-slate-500">{createdAt}</p>
        </div>
        {meta.length > 0 ? (
          <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
            {meta.map((item) => (
              <div key={item.label} className="flex justify-between gap-4">
                <span className="text-slate-500">{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        ) : null}
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-start text-slate-500">
              <th className="py-2 font-medium">{messages.item}</th>
              <th className="py-2 font-medium">{messages.qty}</th>
              <th className="py-2 font-medium">{priceLabel ?? messages.price}</th>
              <th className="py-2 text-end font-medium">{messages.total}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={`${line.name}-${index}`} className="border-b border-slate-100">
                <td className="py-2">
                  <div>{line.name}</div>
                  {line.detailLines?.map((detail) => (
                    <p key={detail} className="text-xs text-slate-500">
                      {detail}
                    </p>
                  ))}
                </td>
                <td className="py-2">{line.qty}</td>
                <td className="py-2 tabular-nums">{amount(line.unitPrice)}</td>
                <td className="py-2 text-end tabular-nums">{amount(line.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-between border-t border-slate-300 pt-3 text-base font-semibold">
          <span>{totalLabel}</span>
          <span className="tabular-nums">{amount(totalAmount)}</span>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">{footer}</p>
      </div>
    </div>
  );
}
