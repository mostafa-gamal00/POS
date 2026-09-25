import { cookies } from "next/headers";
import { messagesFor, type Locale, type Messages } from "@/lib/i18n";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get("locale")?.value === "ar" ? "ar" : "en";
}

export async function getMessages(): Promise<Messages> {
  return messagesFor(await getLocale());
}
