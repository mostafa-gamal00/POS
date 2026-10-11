import { describe, expect, it } from "vitest";
import { filterProducts, resolveProductChoice, type ProductSearchHit } from "./product-search";

const products: ProductSearchHit[] = [
  { id: "a", name: "Tea", sku: "TEA-1", barcode: "111" },
  { id: "b", name: "Coffee", sku: null, barcode: null },
];

describe("filterProducts", () => {
  it("matches name, sku, or barcode", () => {
    expect(filterProducts(products, "tea").map((product) => product.id)).toEqual(["a"]);
    expect(filterProducts(products, "111").map((product) => product.id)).toEqual(["a"]);
    expect(filterProducts(products, "")).toEqual([]);
  });
});

describe("resolveProductChoice", () => {
  it("uses the selected product", () => {
    expect(resolveProductChoice(products, "b", "zzz")).toEqual({ kind: "existing", id: "b" });
  });

  it("creates a name that is not in the list", () => {
    expect(resolveProductChoice(products, "", "Sugar")).toEqual({ kind: "create", name: "Sugar" });
  });

  it("uses an exact name when nothing was clicked", () => {
    expect(resolveProductChoice(products, "", "coffee")).toEqual({ kind: "existing", id: "b" });
  });
});
