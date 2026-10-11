import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReceiptPrint } from "@/components/receipts/receipt-print";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatEnteredPurchaseMoney, formatPurchaseMoney } from "@/lib/utils";
import type { Purchase, PurchaseItem, ShopSettings } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseDetailPage({ params }: PageProps) {
  const auth = await requirePermission("purchases.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: purchase }, { data: items }, { data: settings }] =
    await Promise.all([
      supabase
        .from("purchases")
        .select("*, suppliers(id, name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("purchase_items")
        .select("*, products(id, name, sku)")
        .eq("purchase_id", id),
      supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
  if (!purchase) {
    notFound();
  }
  const purchaseRow = purchase as Purchase;
  const purchaseItems = (items ?? []) as PurchaseItem[];
  const hasCurrencyInvoice = purchaseRow.invoice_total_egp != null;
  const shop = (settings ?? {
    shop_name: "My Shop",
    receipt_footer: "Goods received",
  }) as ShopSettings;
  return (
    <AppShell
      auth={auth}
      locale={locale}
      title={`${messages.navPurchases} ${purchaseRow.receipt_number}`}
    >
      <div className="print:hidden mb-4">
        <Link href="/purchases" className="text-sm text-slate-600 underline">
          {messages.backToPurchases}
        </Link>
      </div>
      <ReceiptPrint
        title={messages.purchaseReceipt}
        shopName={shop.shop_name}
        receiptNumber={purchaseRow.receipt_number}
        createdAt={formatDateTime(purchaseRow.created_at)}
        footer={shop.receipt_footer || "Goods received"}
        totalLabel={hasCurrencyInvoice ? messages.invoiceInEgp : messages.totalCost}
        totalAmount={Number(purchaseRow.total_cost)}
        amountCurrency={hasCurrencyInvoice ? "EGP" : "USD"}
        locale={locale}
        meta={[
          {
            label: messages.supplier,
            value: purchaseRow.suppliers?.name ?? "—",
          },
          { label: messages.receivedBy, value: auth.fullName || auth.email },
          ...(hasCurrencyInvoice
            ? [
                {
                  label: messages.invoiceTotal,
                  value: formatEnteredPurchaseMoney(
                    purchaseRow.invoice_currency,
                    purchaseRow.invoice_total_sar,
                    purchaseRow.invoice_total_egp,
                    locale,
                  ),
                },
                ...(purchaseRow.exchange_rate != null
                  ? [
                      {
                        label: messages.exchangeRate,
                        value: String(Number(purchaseRow.exchange_rate)),
                      },
                    ]
                  : []),
                {
                  label: messages.transportation,
                  value: formatEnteredPurchaseMoney(
                    purchaseRow.transport_currency,
                    purchaseRow.transport_sar,
                    purchaseRow.transport_egp,
                    locale,
                  ),
                },
              ]
            : []),
        ]}
        lines={purchaseItems.map((item) => ({
          name: item.products?.name ?? "Product",
          qty: item.qty,
          unitPrice: Number(item.unit_cost),
          lineTotal: Number(item.line_total),
          detailLines: [
            ...(item.currency && item.unit_price != null
              ? [
                  `${messages.enteredPrice}: ${formatPurchaseMoney(Number(item.unit_price), item.currency, locale)}`,
                  `${messages.transportation}: ${formatPurchaseMoney(Number(item.transport_egp ?? 0), "EGP", locale)}`,
                ]
              : []),
            ...(item.serial ? [`${messages.serial}: ${item.serial}`] : []),
          ],
        }))}
      />
    </AppShell>
  );
}
