import { AppShell } from "@/components/layout/app-shell";
import { ProductForm } from "@/components/products/product-form";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";

export default async function NewProductPage() {
  const auth = await requirePermission("products.manage");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("name");
  return (
    <AppShell auth={auth} locale={locale} title={messages.createProduct}>
      <ProductForm
        canManage={hasPermission(auth, "products.manage")}
        categories={(data ?? []) as Category[]}
      />
    </AppShell>
  );
}
