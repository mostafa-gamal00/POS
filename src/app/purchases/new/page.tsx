import { AppShell } from "@/components/layout/app-shell";
import { PurchaseForm } from "@/components/admin/purchase-form";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Category, Product, Supplier } from "@/types/database";

export default async function NewPurchasePage() {
  const auth = await requirePermission("purchases.manage");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const [{ data: products }, { data: suppliers }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*, categories(id, name)").eq("is_active", true).order("name"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);
  return (
    <AppShell auth={auth} locale={locale} title={messages.receiveGoods}>
      <PurchaseForm
        products={(products ?? []) as Product[]}
        suppliers={(suppliers ?? []) as Supplier[]}
        categories={(categories ?? []) as Category[]}
      />
    </AppShell>
  );
}
