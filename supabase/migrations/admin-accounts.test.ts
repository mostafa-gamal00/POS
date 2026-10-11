import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20261012001000_admin_accounts.sql"),
  "utf8",
);

describe("admin accounts migration", () => {
  it("requires the confirmation word and does not write the new password to the log", () => {
    expect(sql).toContain("p_confirmation is distinct from 'dodo'");
    expect(sql).toContain("Confirmation word is incorrect");
    expect(sql).toContain("'Super admin password changed'");
    expect(sql).not.toContain("p_new_password ||");
    expect(sql).not.toContain("summary, p_new_password");
  });
});
