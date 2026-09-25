import { describe, expect, it } from "vitest";
import { cn, formatDateTime, formatMoney } from "./utils";

describe("formatMoney", () => {
  it("formats a number as USD", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
  });

  it("formats a numeric string", () => {
    expect(formatMoney("3")).toBe("$3.00");
  });

  it("formats a non-numeric string as zero", () => {
    expect(formatMoney("nope")).toBe("$0.00");
  });
});

describe("formatDateTime", () => {
  it("formats an ISO timestamp", () => {
    expect(formatDateTime("2026-03-25T14:05:00.000Z")).toMatch(
      /25 Mar 2026 \d{2}:\d{2}/,
    );
  });
});

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
