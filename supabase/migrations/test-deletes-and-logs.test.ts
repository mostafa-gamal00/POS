import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261011235000_test_deletes_and_logs.sql"),
  "utf8",
);

describe("test deletes and logs migration", () => {
  it("adds the test flag and an activity log", () => {
    expect(sql).toContain("add column if not exists is_test boolean not null default false");
    expect(sql).toContain("create table if not exists public.activity_logs");
    expect(sql).toContain("insert into public.activity_logs");
  });

  it("refuses a product on an invoice and a sale or purchase that is not a test", () => {
    expect(sql).toContain("Product is on an invoice");
    expect(sql).toContain("Only a test sale can be deleted");
    expect(sql).toContain("Only a test purchase can be deleted");
    expect(sql).toContain("Not enough stock to undo this purchase");
  });
});
