import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261011192500_purchase_currency.sql"),
  "utf8",
);

describe("purchase currency migration", () => {
  it("stores the riyal total, rate, and transportation", () => {
    expect(sql).toContain("invoice_total_sar");
    expect(sql).toContain("exchange_rate");
    expect(sql).toContain("invoice_total_egp");
    expect(sql).toContain("transport_sar");
    expect(sql).toContain("transport_egp");
    expect(sql).toContain("purchase_items_currency_check");
  });

  it("replaces create_purchase and refuses an unbalanced invoice", () => {
    expect(sql).toContain("drop function if exists public.create_purchase(uuid, text, jsonb)");
    expect(sql).toContain("Invoice is not balanced");
    expect(sql).toContain("v_base := v_transport_cents / v_total_qty");
    expect(sql).toContain("v_remainder := v_transport_cents - (v_base * v_total_qty)");
  });
});
