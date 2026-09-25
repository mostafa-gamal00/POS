import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(__dirname, "20260925120000_auth_context.sql"),
  "utf8",
);

describe("auth context migration", () => {
  it("returns one json object for the signed-in user", () => {
    expect(sql).toContain("function public.auth_context()");
    expect(sql).toContain("auth_is_super_admin()");
    expect(sql).toContain("auth_my_permissions()");
    expect(sql).toContain("'full_name'");
    expect(sql).toContain("'permissions'");
    expect(sql).toContain("'roles'");
    expect(sql).toContain("grant execute on function public.auth_context()");
  });
});