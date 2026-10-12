import { createClient } from "@/lib/supabase/server";
import type { StorefrontProduct, StorefrontSettings } from "@/types/database";

const emptySettings: StorefrontSettings = {
  shop_name: "My Shop",
  phone: "",
  email: "",
  address: "",
  about: "",
};

export async function loadStorefrontSettings(): Promise<StorefrontSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("storefront_settings")
    .select("shop_name, phone, email, address, about")
    .limit(1)
    .maybeSingle();
  return (data as StorefrontSettings | null) ?? emptySettings;
}

export async function loadStorefrontProducts(): Promise<StorefrontProduct[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("storefront_products")
    .select("id, name, price, image_url, category_name")
    .order("name");
  return (data ?? []) as StorefrontProduct[];
}
