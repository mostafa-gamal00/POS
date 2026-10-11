import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261011211500_purchase_header_currency.sql"),
  "utf8",
);

describe("purchase header currency migration", () => {
  it("stores the currency of the invoice total and transportation", () => {
    expect(sql).toContain("invoice_currency");
    expect(sql).toContain("transport_currency");
    expect(sql).toContain("purchases_invoice_currency_check");
    expect(sql).toContain("purchases_transport_currency_check");
    expect(sql).toContain("set invoice_currency = 'SAR'");
    expect(sql).toContain("set transport_currency = 'SAR'");
  });

  it("replaces create_purchase and requires a rate only for riyal", () => {
    expect(sql).toContain(
      "drop function if exists public.create_purchase(uuid, text, jsonb, text, text, text)",
    );
    expect(sql).toContain("Invalid exchange rate");
    expect(sql).toContain("v_invoice_currency = 'SAR'");
    expect(sql).toContain("v_invoice_sar := null");
    expect(sql).toContain("Invoice is not balanced");
  });
});
