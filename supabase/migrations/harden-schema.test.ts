import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20260925000000_harden_schema.sql"),
  "utf8",
);

describe("harden schema migration", () => {
  it("requires non-negative stock", () => {
    expect(sql).toContain("products_stock_qty_non_negative");
    expect(sql).toContain("check (stock_qty >= 0)");
  });

  it("adds updated_at and the timestamp trigger", () => {
    expect(sql).toContain("add column if not exists updated_at");
    expect(sql).toContain("function public.set_updated_at()");
  });

  it("indexes foreign keys and list filters", () => {
    const indexes = [
      "sale_items_sale_id_idx",
      "sale_items_product_id_idx",
      "purchase_items_purchase_id_idx",
      "purchase_items_product_id_idx",
      "stock_movements_product_created_idx",
      "sales_created_at_idx",
      "purchases_created_at_idx",
      "user_roles_user_id_idx",
      "role_permissions_role_id_idx",
    ];
    for (const name of indexes) {
      expect(sql).toContain(name);
    }
  });

  it("blocks direct stock changes unless the session flag is on", () => {
    expect(sql).toContain("function public.guard_product_stock_qty()");
    expect(sql).toContain("app.allow_stock_change");
    expect(sql).toContain("products_guard_stock_qty");
  });

  it("sets the stock flag inside each stock RPC", () => {
    const flag = "set_config('app.allow_stock_change', 'on', true)";
    expect(sql.split(flag).length - 1).toBe(3);
  });

  it("refuses a negative adjust_stock result in the update", () => {
    expect(sql).toContain("stock_qty + p_change_qty >= 0");
    expect(sql).toContain("Stock cannot be negative");
  });
});
