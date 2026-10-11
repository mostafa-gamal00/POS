import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { ExportButton } from "@/components/export-button";
import { AppShell } from "@/components/layout/app-shell";
import { ProductImage } from "@/components/products/product-image";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { Product } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const auth = await requirePermission("products.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*, categories(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) {
    notFound();
  }
  const product = data as Product;
  const canManage = hasPermission(auth, "products.manage");
  return (
    <AppShell auth={auth} locale={locale} title={product.name}>
      <div className="max-w-xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        {product.image_url ? (
          <ProductImage src={product.image_url} alt={product.name} />
        ) : null}
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{messages.serial}</dt>
            <dd>{product.serial ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{messages.category}</dt>
            <dd>{product.categories?.name ?? messages.uncategorized}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{messages.price}</dt>
            <dd>{formatMoney(Number(product.price))}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{messages.stock}</dt>
            <dd>{product.stock_qty}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-500">{messages.status}</dt>
            <dd>{product.is_active ? messages.active : messages.inactive}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <ExportButton
            label={messages.exportData}
            filename={`${product.name.replace(/[\\/:*?"<>|]/g, "-")}.csv`}
            headers={[
              messages.name,
              messages.serial,
              messages.category,
              messages.price,
              messages.stock,
              messages.status,
            ]}
            rows={[
              [
                product.name,
                product.serial ?? "",
                product.categories?.name ?? messages.uncategorized,
                formatMoney(Number(product.price)),
                String(product.stock_qty),
                product.is_active ? messages.active : messages.inactive,
              ],
            ]}
          />
          {canManage ? (
            <DeleteProductButton productId={product.id} label={messages.delete} />
          ) : null}
          {canManage ? (
            <Link
              href={`/products/${product.id}/edit`}
              className="rounded-md bg-teal-900 px-3 py-2 text-sm font-medium text-white"
            >
              {messages.edit}
            </Link>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
