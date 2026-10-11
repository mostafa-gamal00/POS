import Link from "next/link";
import { notFound } from "next/navigation";
import { TestInvoiceActions } from "@/components/records/test-invoice-actions";
import { ExportButton } from "@/components/export-button";
import { AppShell } from "@/components/layout/app-shell";
import { ReceiptPrint } from "@/components/receipts/receipt-print";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney } from "@/lib/utils";
import type { Sale, SaleItem, ShopSettings } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SaleDetailPage({ params }: PageProps) {
  const auth = await requirePermission("sales.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: sale }, { data: items }, { data: settings }] =
    await Promise.all([
      supabase.from("sales").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("sale_items")
        .select("*, products(id, name, sku)")
        .eq("sale_id", id),
      supabase.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
    ]);
  if (!sale) {
    notFound();
  }
  const saleRow = sale as Sale;
  const saleItems = (items ?? []) as SaleItem[];
  const shop = (settings ?? {
    shop_name: "My Shop",
    receipt_footer: "Thank you",
  }) as ShopSettings;
  return (
    <AppShell
      auth={auth}
      locale={locale}
      title={`${messages.navSales} ${saleRow.receipt_number}`}
    >
      <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/sales" className="text-sm text-slate-600 underline">
          {messages.backToSales}
        </Link>
        <ExportButton
          label={messages.exportData}
          filename={`${saleRow.receipt_number}.csv`}
          headers={[messages.product, messages.qty, messages.unitPrice, messages.lineTotal]}
          rows={saleItems.map((item) => [
            item.products?.name ?? "",
            String(item.qty),
            formatMoney(Number(item.unit_price)),
            formatMoney(Number(item.line_total)),
          ])}
        />
        <TestInvoiceActions
          kind="sale"
          id={saleRow.id}
          isTest={saleRow.is_test}
          canMark={hasPermission(auth, "pos.sell")}
          canDelete={hasPermission(auth, "pos.sell")}
          testLabel={messages.testRecord}
          deleteLabel={messages.delete}
          backHref="/sales"
        />
      </div>
      <ReceiptPrint
        title={messages.saleReceipt}
        shopName={shop.shop_name}
        receiptNumber={saleRow.receipt_number}
        createdAt={formatDateTime(saleRow.created_at)}
        footer={shop.receipt_footer}
        priceLabel={messages.soldPrice}
        totalLabel={messages.total}
        totalAmount={Number(saleRow.total_amount)}
        meta={[
          { label: messages.payment, value: messages[saleRow.payment_method] },
          { label: messages.cashier, value: auth.fullName || auth.email },
        ]}
        lines={saleItems.map((item) => ({
          name: item.products?.name ?? "Product",
          qty: item.qty,
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
        }))}
      />
    </AppShell>
  );
}
