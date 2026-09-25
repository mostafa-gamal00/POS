"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useMessages } from "@/components/i18n/locale-provider";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n";

type LoginFormProps = {
  locale: Locale;
};

export function LoginForm({ locale }: LoginFormProps) {
  const router = useRouter();
  const messages = useMessages();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const supabase = createClient();
    if (mode === "signin") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }
    } else {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (signUpError) {
        setError(signUpError.message);
        setIsLoading(false);
        return;
      }
    }
    router.push("/dashboard");
    router.refresh();
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
            {messages.brand}
          </p>
          <LanguageSwitch locale={locale} tone="light" />
        </div>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {mode === "signin" ? messages.signIn : messages.createAccount}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{messages.firstUserAdmin}</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "signup" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">{messages.fullName}</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">{messages.email}</span>
            <input
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">{messages.password}</span>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </label>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isLoading
              ? messages.pleaseWait
              : mode === "signin"
                ? messages.signIn
                : messages.signUp}
          </button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm text-slate-600 underline"
          onClick={() =>
            setMode((current) => (current === "signin" ? "signup" : "signin"))
          }
        >
          {mode === "signin" ? messages.needAccount : messages.haveAccount}
        </button>
      </div>
    </div>
  );
}
