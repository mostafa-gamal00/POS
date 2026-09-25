import { AppShell } from "@/components/layout/app-shell";
import { PosClient } from "@/components/pos/pos-client";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

export default async function PosPage() {
  const auth = await requirePermission("pos.sell");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return (
    <AppShell auth={auth} locale={locale} title={messages.navPos}>
      <PosClient products={(data ?? []) as Product[]} />
    </AppShell>
  );
}
