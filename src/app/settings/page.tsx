import { AppShell } from "@/components/layout/app-shell";
import { SettingsForm } from "@/components/admin/settings-form";
import { requirePermission } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import type { ShopSettings } from "@/types/database";

export default async function SettingsPage() {
  const auth = await requirePermission("settings.manage");
  const locale = await getLocale();
  const messages = await getMessages();
  const supabase = await createClient();
  const { data } = await supabase
    .from("shop_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const settings = (data ?? {
    id: 1,
    shop_name: "My Shop",
    receipt_footer: "Thank you for your business",
    updated_at: new Date().toISOString(),
  }) as ShopSettings;
  return (
    <AppShell auth={auth} locale={locale} title={messages.navSettings}>
      <SettingsForm settings={settings} />
    </AppShell>
  );
}
