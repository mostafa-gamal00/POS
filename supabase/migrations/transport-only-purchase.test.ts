import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261014224500_transport_only_purchase.sql"),
  "utf8",
);

describe("transport-only purchase migration", () => {
  it("accepts an empty item list and does not divide transportation when there are no units", () => {
    expect(sql).not.toContain("jsonb_array_length(p_items) = 0");
    expect(sql).toContain("if v_total_qty > 0 then");
    expect(sql).toContain("v_base := v_transport_cents / v_total_qty");
    expect(sql).toContain("v_base := 0");
    expect(sql).toContain("v_remainder := 0");
    expect(sql).not.toContain("transport > 0");
    expect(sql).toContain("create or replace function public.create_purchase");
    expect(sql).toContain("create or replace function public.update_purchase");
  });
});