import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ProductForm } from "@/components/products/product-form";
import { hasPermission, requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product } from "@/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: PageProps) {
  const auth = await requirePermission("products.manage");
  const locale = await getLocale();
  const messages = await getMessages();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: categoryRows }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("name"),
  ]);
  if (!data) {
    notFound();
  }
  return (
    <AppShell auth={auth} locale={locale} title={messages.updateProduct}>
      <ProductForm
        product={data as Product}
        canManage={hasPermission(auth, "products.manage")}
        categories={(categoryRows ?? []) as Category[]}
        locale={locale}
      />
    </AppShell>
  );
}
