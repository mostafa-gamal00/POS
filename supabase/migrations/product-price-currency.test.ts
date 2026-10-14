import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261014224000_product_price_currency.sql"),
  "utf8",
);

describe("product price currency migration", () => {
  it("stores the entered currency and backfills existing prices as EGP", () => {
    expect(sql).toContain("price_currency");
    expect(sql).toContain("entered_price");
    expect(sql).toContain("price_exchange_rate");
    expect(sql).toContain("price_currency = 'EGP'");
    expect(sql).toContain("entered_price = price");
    expect(sql).toContain("products_price_currency_check");
    expect(sql).toContain("products_price_matches_currency");
    expect(sql).toContain("price = round(entered_price * price_exchange_rate, 2)");
  });
});
