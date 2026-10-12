import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import type { Locale, Messages } from "@/lib/i18n";

type StoreShellProps = {
  locale: Locale;
  messages: Messages;
  shopName: string;
  children: ReactNode;
};

export function StoreShell({ locale, messages, shopName, children }: StoreShellProps) {
  return (
    <div className="min-h-full bg-stone-50 text-stone-950">
      <header className="bg-teal-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <Link href="/shop" className="text-2xl font-semibold tracking-tight">
            {shopName}
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/shop" className="rounded-lg px-3 py-2 text-teal-50 hover:bg-white/10">
              {messages.navShop}
            </Link>
            <Link href="/contact" className="rounded-lg px-3 py-2 text-teal-50 hover:bg-white/10">
              {messages.contactUs}
            </Link>
          </nav>
          <div className="w-40">
            <LanguageSwitch locale={locale} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
