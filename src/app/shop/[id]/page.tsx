import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreShell } from "@/components/storefront/store-shell";
import { getLocale, getMessages } from "@/lib/locale";
import { loadStorefrontSettings } from "@/lib/storefront";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { StorefrontProduct } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShopProductPage({ params }: PageProps) {
  const locale = await getLocale();
  const messages = await getMessages();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([
    supabase
      .from("storefront_products")
      .select("id, name, price, image_url, category_name")
      .eq("id", id)
      .maybeSingle(),
    loadStorefrontSettings(),
  ]);
  if (!data) {
    notFound();
  }
  const product = data as StorefrontProduct;
  return (
    <StoreShell locale={locale} messages={messages} shopName={settings.shop_name}>
      <Link href="/shop" className="text-sm font-medium text-teal-800 underline">
        {messages.navShop}
      </Link>
      <article className="mt-4 grid gap-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm md:grid-cols-2">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full max-h-[32rem] w-full object-cover" />
        ) : (
          <div className="flex min-h-80 items-center justify-center bg-teal-800 text-7xl font-semibold text-amber-200">
            {product.name.slice(0, 1)}
          </div>
        )}
        <div className="space-y-4 p-6 md:p-8">
          <p className="text-sm font-medium text-teal-800">
            {product.category_name || messages.uncategorized}
          </p>
          <h1 className="text-4xl font-semibold">{product.name}</h1>
          <p className="text-3xl font-semibold text-amber-800">{formatMoney(product.price)}</p>
        </div>
      </article>
    </StoreShell>
  );
}
