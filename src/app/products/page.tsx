import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { CategoryForm } from "@/components/products/category-form";
import { ViewLink } from "@/components/products/view-link";
import { hasPermission, requirePermission } from "@/lib/auth";
import { fill } from "@/lib/i18n";
import { getLocale, getMessages } from "@/lib/locale";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";
import type { Category, Product } from "@/types/database";

export default async function ProductsPage() {
  const auth = await requirePermission("products.view");
  const locale = await getLocale();
  const messages = await getMessages();
  const canManage = hasPermission(auth, "products.manage");
  const supabase = await createClient();
  const [{ data }, { data: categoryRows }] = await Promise.all([
    supabase.from("products").select("*, categories(id, name)").order("name"),
    supabase.from("categories").select("*").order("name"),
  ]);
  const products = (data ?? []) as Product[];
  const categories = (categoryRows ?? []) as Category[];
  const groups = new Map<string, { name: string; products: Product[] }>();
  for (const category of categories) {
    groups.set(category.id, { name: category.name, products: [] });
  }
  const uncategorized: Product[] = [];
  for (const product of products) {
    if (product.category_id && groups.has(product.category_id)) {
      groups.get(product.category_id)?.products.push(product);
    } else {
      uncategorized.push(product);
    }
  }
  return (
    <AppShell auth={auth} locale={locale} title={messages.navProducts}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-slate-600">
          {fill(messages.productsCount, { count: products.length })}
        </p>
        {canManage ? (
          <Link
            href="/products/new"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            {messages.addProduct}
          </Link>
        ) : null}
      </div>
      {canManage ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <CategoryForm categories={categories} />
        </section>
      ) : null}
      {[...groups.values(), { name: messages.uncategorized, products: uncategorized }]
        .filter((group) => group.products.length > 0)
        .map((group) => (
          <section key={group.name} className="mb-6">
            <h3 className="mb-2 text-lg font-semibold text-teal-950">{group.name}</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-start text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">{messages.product}</th>
                    <th className="px-4 py-3 font-medium">{messages.price}</th>
                    <th className="px-4 py-3 font-medium">{messages.stock}</th>
                    <th className="px-4 py-3 font-medium">{messages.status}</th>
                    <th className="px-4 py-3 font-medium">{messages.view}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.products.map((product) => (
                    <tr key={product.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded bg-slate-100">
                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={product.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-slate-500">
                              {product.sku ?? messages.noSku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatMoney(Number(product.price))}</td>
                      <td className="px-4 py-3">{product.stock_qty}</td>
                      <td className="px-4 py-3">
                        {product.is_active ? messages.active : messages.inactive}
                      </td>
                      <td className="px-4 py-3">
                        <ViewLink href={`/products/${product.id}`} label={messages.view} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      {products.length === 0 ? (
        <p className="text-sm text-slate-500">{messages.noProducts}</p>
      ) : null}
    </AppShell>
  );
}
