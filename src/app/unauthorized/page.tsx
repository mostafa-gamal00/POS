import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { fill } from "@/lib/i18n";
import { getMessages } from "@/lib/locale";

export default async function UnauthorizedPage() {
  const auth = await requireAuth();
  const messages = await getMessages();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">{messages.accessDenied}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {fill(messages.accessDeniedBody, { email: auth.email })}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link href="/dashboard" className="text-sm underline">
            {messages.navDashboard}
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm underline">
              {messages.signOut}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
