"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMessages } from "@/components/i18n/locale-provider";
import { formatMoney } from "@/lib/utils";
import type { StorefrontProduct } from "@/types/database";

type CatalogGridProps = {
  products: StorefrontProduct[];
};

export function CatalogGrid({ products }: CatalogGridProps) {
  const messages = useMessages();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const product of products) {
      if (product.category_name) {
        names.add(product.category_name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [products]);
  const hasUncategorized = products.some((product) => !product.category_name);
  const visible = products.filter((product) => {
    const matchesName = product.name.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory =
      category === "" ||
      (category === "__none__"
        ? !product.category_name
        : product.category_name === category);
    return matchesName && matchesCategory;
  });
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={messages.catalogSearch}
          className="rounded-xl border-2 border-teal-900 bg-white px-4 py-3 text-base outline-none focus:ring-2 focus:ring-amber-300"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-xl border-2 border-teal-900 bg-white px-4 py-3 text-base"
        >
          <option value="">{messages.allCategories}</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {hasUncategorized ? (
            <option value="__none__">{messages.uncategorized}</option>
          ) : null}
        </select>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-stone-200 bg-white px-4 py-10 text-center text-stone-600">
          {messages.noPublicProducts}
        </p>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <li key={product.id}>
              <Link
                href={`/shop/${product.id}`}
                className="block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="h-56 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-56 items-center justify-center bg-teal-800 text-5xl font-semibold text-amber-200">
                    {product.name.slice(0, 1)}
                  </div>
                )}
                <div className="space-y-2 p-4">
                  <p className="text-sm text-teal-800">
                    {product.category_name || messages.uncategorized}
                  </p>
                  <h2 className="text-xl font-semibold">{product.name}</h2>
                  <p className="text-lg font-semibold text-amber-800">
                    {formatMoney(product.price)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
