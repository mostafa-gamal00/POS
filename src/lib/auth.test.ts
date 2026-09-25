import { describe, expect, it, vi } from "vitest";
import type { AuthContext } from "./auth";
import { hasPermission } from "./auth";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function context(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    email: "cashier@shop.test",
    fullName: "Cashier",
    isSuperAdmin: false,
    permissions: ["pos.sell"],
    roles: [],
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("allows a super admin without the permission code", () => {
    expect(
      hasPermission(context({ isSuperAdmin: true, permissions: [] }), "roles.manage"),
    ).toBe(true);
  });

  it("allows a granted permission", () => {
    expect(hasPermission(context(), "pos.sell")).toBe(true);
  });

  it("rejects a missing permission", () => {
    expect(hasPermission(context(), "roles.manage")).toBe(false);
  });
});
