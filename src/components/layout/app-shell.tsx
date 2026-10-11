"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LanguageSwitch } from "@/components/i18n/language-switch";
import { useMessages } from "@/components/i18n/locale-provider";
import { hasPermission, type AuthContext } from "@/lib/auth-shared";
import type { Messages } from "@/lib/i18n";
import type { PermissionCode } from "@/types/database";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: keyof Messages;
  permission?: PermissionCode;
  superAdminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "navDashboard", permission: "dashboard.view" },
  { href: "/logs", labelKey: "navLogs", permission: "dashboard.view" },
  { href: "/pos", labelKey: "navPos", permission: "pos.sell" },
  { href: "/products", labelKey: "navProducts", permission: "products.view" },
  { href: "/sales", labelKey: "navSales", permission: "sales.view" },
  { href: "/purchases", labelKey: "navPurchases", permission: "purchases.view" },
  { href: "/stock", labelKey: "navStock", permission: "stock.adjust" },
  { href: "/settings", labelKey: "navSettings", permission: "settings.manage" },
  { href: "/admin/users", labelKey: "navUsers", permission: "users.manage" },
  {
    href: "/admin/roles",
    labelKey: "navRoles",
    permission: "roles.manage",
    superAdminOnly: true,
  },
  {
    href: "/admin/permissions",
    labelKey: "navPermissions",
    permission: "roles.manage",
    superAdminOnly: true,
  },
];

type AppShellProps = {
  auth: AuthContext;
  children: React.ReactNode;
  title: string;
  locale: "en" | "ar";
};

export function AppShell({ auth, children, title, locale }: AppShellProps) {
  const messages = useMessages();
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.superAdminOnly && !auth.isSuperAdmin) {
      return false;
    }
    if (!item.permission) {
      return true;
    }
    return hasPermission(auth, item.permission);
  });
  return (
    <div className="min-h-screen bg-[#f4f1ea] text-stone-900">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="print:hidden flex w-full flex-col bg-teal-950 text-white md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0">
          <div className="space-y-4 px-5 py-6">
            <div>
              <p className="text-sm font-medium text-amber-200">{messages.brand}</p>
              <h1 className="mt-1 text-2xl font-semibold">{messages.shopConsole}</h1>
            </div>
            <LanguageSwitch locale={locale} />
            <div>
              <p className="truncate text-sm text-teal-100">
                {auth.fullName || auth.email}
              </p>
              {auth.isSuperAdmin ? (
                <span className="mt-2 inline-block rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-medium text-teal-950">
                  {messages.superAdmin}
                </span>
              ) : null}
            </div>
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
            {visibleItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-sm text-teal-100 hover:bg-white/10 hover:text-white",
                    active && "bg-amber-200 font-medium text-teal-950 hover:bg-amber-200 hover:text-teal-950",
                  )}
                >
                  {messages[item.labelKey]}
                </Link>
              );
            })}
          </nav>
          <form action="/auth/signout" method="post" className="px-3 pb-6">
            <button
              type="submit"
              className="w-full rounded-lg border border-white/15 px-3 py-2.5 text-start text-sm text-teal-100 hover:bg-white/10"
            >
              {messages.signOut}
            </button>
          </form>
        </aside>
        <main className="min-w-0 flex-1 p-4 md:p-8">
          <header className="print:hidden mb-6 border-b border-stone-200 pb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-teal-950">
              {title}
            </h2>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
