import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261012120000_unbalanced_purchase_edit.sql"),
  "utf8",
);

describe("unbalanced purchase edit migration", () => {
  it("saves an invoice that does not match and edits stock by the quantity change", () => {
    expect(sql).not.toContain("Invoice is not balanced");
    expect(sql).toContain("create or replace function public.update_purchase");
    expect(sql).toContain("stock_qty = stock_qty + v_change");
    expect(sql).toContain("Not enough stock to undo this purchase");
  });
});
