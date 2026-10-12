import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261012130000_storefront.sql"),
  "utf8",
);

const privateWords = ["cost", "stock", "sku", "barcode", "serial", "sales", "purchases"];

describe("storefront migration", () => {
  it("exposes only the public columns and grants select", () => {
    expect(sql).toContain("create or replace view public.storefront_products");
    expect(sql).toContain("create or replace view public.storefront_settings");
    expect(sql).toContain("p.name");
    expect(sql).toContain("p.price");
    expect(sql).toContain("p.image_url");
    expect(sql).toContain("c.name as category_name");
    expect(sql).toContain("shop_name");
    expect(sql).toContain("phone");
    expect(sql).toContain("email");
    expect(sql).toContain("address");
    expect(sql).toContain("about");
    expect(sql).toContain("grant select on table public.storefront_products to anon, authenticated");
    expect(sql).toContain("grant select on table public.storefront_settings to anon, authenticated");
    const lowered = sql.toLowerCase();
    for (const word of privateWords) {
      expect(lowered).not.toContain(word);
    }
  });
});
