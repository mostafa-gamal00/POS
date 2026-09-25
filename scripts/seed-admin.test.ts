import { describe, expect, it } from "vitest";
import { readAdminCredentials } from "./seed-admin";

describe("readAdminCredentials", () => {
  it("rejects a missing email", () => {
    expect(() =>
      readAdminCredentials({ SUPER_ADMIN_PASSWORD: "long-enough" }),
    ).toThrow(/SUPER_ADMIN_EMAIL is missing/);
  });

  it("rejects a missing password", () => {
    expect(() =>
      readAdminCredentials({ SUPER_ADMIN_EMAIL: "admin@shop.local" }),
    ).toThrow(/SUPER_ADMIN_PASSWORD is missing/);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() =>
      readAdminCredentials({
        SUPER_ADMIN_EMAIL: "admin@shop.local",
        SUPER_ADMIN_PASSWORD: "short",
      }),
    ).toThrow(/at least 8 characters/);
  });

  it("returns a lowercase email and the password", () => {
    expect(
      readAdminCredentials({
        SUPER_ADMIN_EMAIL: " Admin@Shop.Local ",
        SUPER_ADMIN_PASSWORD: "long-enough",
      }),
    ).toEqual({
      email: "admin@shop.local",
      password: "long-enough",
    });
  });
});
