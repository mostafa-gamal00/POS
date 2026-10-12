import { StoreShell } from "@/components/storefront/store-shell";
import { getLocale, getMessages } from "@/lib/locale";
import { loadStorefrontSettings } from "@/lib/storefront";

export default async function ContactPage() {
  const locale = await getLocale();
  const messages = await getMessages();
  const settings = await loadStorefrontSettings();
  const rows = [
    settings.phone ? { label: messages.phone, value: settings.phone, href: `tel:${settings.phone}` } : null,
    settings.email ? { label: messages.email, value: settings.email, href: `mailto:${settings.email}` } : null,
    settings.address ? { label: messages.address, value: settings.address, href: null } : null,
  ].filter((row) => row !== null);
  return (
    <StoreShell locale={locale} messages={messages} shopName={settings.shop_name}>
      <section className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:p-10">
        <h1 className="text-4xl font-semibold">{messages.contactUs}</h1>
        {settings.about ? (
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-stone-700">{settings.about}</p>
        ) : null}
        {rows.length > 0 ? (
          <dl className="space-y-4">
            {rows.map((row) => (
              <div key={row.label} className="border-t border-stone-200 pt-4">
                <dt className="text-sm font-medium text-teal-800">{row.label}</dt>
                <dd className="mt-1 text-lg">
                  {row.href ? (
                    <a href={row.href} className="underline">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </section>
    </StoreShell>
  );
}
