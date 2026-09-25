"use client";

import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/locale-action";
import type { Locale } from "@/lib/i18n";
import { useMessages } from "@/components/i18n/locale-provider";

type LanguageSwitchProps = {
  locale: Locale;
  tone?: "light" | "dark";
};

export function LanguageSwitch({ locale, tone = "dark" }: LanguageSwitchProps) {
  const router = useRouter();
  const messages = useMessages();
  const light = tone === "light";
  async function choose(next: Locale) {
    if (next === locale) {
      return;
    }
    await setLocale(next);
    router.refresh();
  }
  return (
    <div
      className={
        light
          ? "grid w-full grid-cols-2 rounded-lg bg-stone-100 p-1"
          : "grid w-full grid-cols-2 rounded-lg bg-white/10 p-1"
      }
      role="group"
      aria-label={messages.language}
    >
      {(["en", "ar"] as const).map((code) => {
        const selected = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => choose(code)}
            className={
              selected
                ? light
                  ? "rounded-md bg-teal-800 px-2 py-1.5 text-xs font-medium text-white"
                  : "rounded-md bg-amber-200 px-2 py-1.5 text-xs font-medium text-teal-950"
                : light
                  ? "rounded-md px-2 py-1.5 text-xs text-stone-600"
                  : "rounded-md px-2 py-1.5 text-xs text-teal-100"
            }
          >
            {code === "en" ? messages.english : messages.arabic}
          </button>
        );
      })}
    </div>
  );
}
