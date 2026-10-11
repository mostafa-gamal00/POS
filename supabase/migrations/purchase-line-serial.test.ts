import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261011230000_purchase_line_serial.sql"),
  "utf8",
);

describe("purchase line serial migration", () => {
  it("stores a unique serial on the product and on each purchase line", () => {
    expect(sql).toContain("add column if not exists serial text");
    expect(sql).toContain("products_serial_unique");
    expect(sql).toContain("purchase_items_serial_unique");
    expect(sql).toContain("where serial is not null");
    expect(sql).toContain("Serial is already used");
  });

  it("refuses an inactive product on a new invoice", () => {
    expect(sql).toContain("Product is inactive");
    expect(sql).toContain("if not v_product.is_active then");
  });
});
