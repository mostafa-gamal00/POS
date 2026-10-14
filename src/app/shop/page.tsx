import { CatalogGrid } from "@/components/storefront/catalog-grid";
import { StoreShell } from "@/components/storefront/store-shell";
import { getLocale, getMessages } from "@/lib/locale";
import { loadStorefrontProducts, loadStorefrontSettings } from "@/lib/storefront";

export default async function ShopPage() {
  const locale = await getLocale();
  const messages = await getMessages();
  const [settings, products] = await Promise.all([
    loadStorefrontSettings(),
    loadStorefrontProducts(),
  ]);
  return (
    <StoreShell locale={locale} messages={messages} shopName={settings.shop_name}>
      <CatalogGrid products={products} locale={locale} />
    </StoreShell>
  );
}
