import path from "node:path";
import { describe, expect, it } from "vitest";
import { listSqlFiles } from "./sql-files";

describe("listSqlFiles", () => {
  it("lists migration sql files in order and skips tests", () => {
    const files = listSqlFiles(
      path.join(process.cwd(), "supabase", "migrations"),
    );
    expect(files).toEqual([
      "20260325000000_init.sql",
      "20260925000000_harden_schema.sql",
      "20260925120000_auth_context.sql",
      "20260925140000_categories.sql",
      "20260925160000_sold_price.sql",
      "20261011192500_purchase_currency.sql",
    ]);
  });

  it("lists seeders in order", () => {
    const files = listSqlFiles(path.join(process.cwd(), "supabase", "seeders"));
    expect(files).toEqual(["001_demo_products.sql"]);
  });
});