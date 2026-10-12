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
      "20261011211500_purchase_header_currency.sql",
      "20261011230000_purchase_line_serial.sql",
      "20261011235000_test_deletes_and_logs.sql",
      "20261012001000_admin_accounts.sql",
      "20261012120000_unbalanced_purchase_edit.sql",
      "20261012130000_storefront.sql",
    ]);
  });

  it("lists seeders in order", () => {
    const files = listSqlFiles(path.join(process.cwd(), "supabase", "seeders"));
    expect(files).toEqual(["001_demo_products.sql"]);
  });
});