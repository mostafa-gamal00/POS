import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PurchaseForm, type PurchaseFormDraft } from "@/components/admin/purchase-form";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product, Purchase, PurchaseCurrency, PurchaseItem, Supplier } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

function plainAmount(value: number | string | null | undefined): string {
  if (value == null || value === "") {
    return "";
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? String(amount) : "";
}

function currencyOf(value: string | null | undefined): PurchaseCurrency {
  return value === "SAR" ? "SAR" : "EGP";
}

export default async function EditPurchasePage({ params }: PageProps) {
  const auth = await requirePermission("purchases.manage");
  const locale = await getLocale();
  const messages = await getMessages();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: purchase }, { data: items }, { data: activeProducts }, { data: suppliers }, { data: categories }] =
    await Promise.all([
      supabase.from("purchases").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("purchase_items")
        .select("*, products(id, name, sku)")
        .eq("purchase_id", id),
      supabase.from("products").select("*, categories(id, name)").eq("is_active", true).order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
  if (!purchase) {
    notFound();
  }
  const purchaseRow = purchase as Purchase;
  const purchaseItems = (items ?? []) as PurchaseItem[];
  const productIds = [...new Set(purchaseItems.map((item) => item.product_id))];
  const { data: linkedProducts } =
    productIds.length > 0
      ? await supabase.from("products").select("*, categories(id, name)").in("id", productIds)
      : { data: [] };
  const products = (activeProducts ?? []) as Product[];
  for (const product of (linkedProducts ?? []) as Product[]) {
    if (!products.some((current) => current.id === product.id)) {
      products.push(product);
    }
  }
  const invoiceCurrency = currencyOf(purchaseRow.invoice_currency);
  const transportCurrency = currencyOf(purchaseRow.transport_currency);
  const draft: PurchaseFormDraft = {
    id: purchaseRow.id,
    isTest: purchaseRow.is_test,
    supplierId: purchaseRow.supplier_id ?? "",
    notes: purchaseRow.notes ?? "",
    invoiceTotal: plainAmount(
      invoiceCurrency === "SAR"
        ? purchaseRow.invoice_total_sar
        : (purchaseRow.invoice_total_egp ?? purchaseRow.total_cost),
    ),
    invoiceCurrency,
    exchangeRate: plainAmount(purchaseRow.exchange_rate),
    transport:
      plainAmount(
        transportCurrency === "SAR" ? purchaseRow.transport_sar : purchaseRow.transport_egp,
      ) || "0",
    transportCurrency,
    lines: purchaseItems.map((item) => ({
      productId: item.product_id,
      productQuery: item.products?.name ?? "",
      categoryId: item.category_id ?? "",
      qty: String(item.qty),
      unitPrice: plainAmount(item.unit_price ?? item.unit_cost),
      currency: currencyOf(item.currency),
      serial: item.serial ?? "",
    })),
  };
  return (
    <AppShell
      auth={auth}
      locale={locale}
      title={`${messages.editInvoice} ${purchaseRow.receipt_number}`}
    >
      <PurchaseForm
        products={products}
        suppliers={(suppliers ?? []) as Supplier[]}
        categories={(categories ?? []) as Category[]}
        locale={locale}
        draft={draft}
      />
    </AppShell>
  );
}
