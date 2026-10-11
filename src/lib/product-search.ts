export type ProductSearchHit = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
};

export function filterProducts<T extends ProductSearchHit>(
  products: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return [];
  }
  return products.filter((product) => {
    return (
      product.name.toLowerCase().includes(normalized) ||
      product.sku?.toLowerCase().includes(normalized) ||
      product.barcode?.toLowerCase().includes(normalized)
    );
  });
}

export function resolveProductChoice(
  products: ProductSearchHit[],
  productId: string,
  query: string,
): { kind: "existing"; id: string } | { kind: "create"; name: string } | { kind: "missing" } {
  if (productId && products.some((product) => product.id === productId)) {
    return { kind: "existing", id: productId };
  }
  const name = query.trim();
  if (!name) {
    return { kind: "missing" };
  }
  const exact = products.filter((product) => product.name.toLowerCase() === name.toLowerCase());
  if (exact.length === 1 && exact[0]) {
    return { kind: "existing", id: exact[0].id };
  }
  if (exact.length > 1) {
    return { kind: "missing" };
  }
  return { kind: "create", name };
}
