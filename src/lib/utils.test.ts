import { describe, expect, it } from "vitest";
import {
  cn,
  formatDateTime,
  formatEnteredPurchaseMoney,
  formatMoney,
  formatPurchaseMoney,
} from "./utils";

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

describe("formatPurchaseMoney", () => {
  it("labels Egyptian pounds and riyals in English and Arabic", () => {
    expect(formatPurchaseMoney(135, "EGP", "en")).toBe("EGP 135.00");
    expect(formatPurchaseMoney(135, "EGP", "ar")).toBe("135.00 ج.م");
    expect(formatPurchaseMoney(10, "SAR", "en")).toBe("SAR 10.00");
    expect(formatPurchaseMoney(10, "SAR", "ar")).toBe("10.00 ر.س");
  });
});

describe("formatEnteredPurchaseMoney", () => {
  it("uses the currency that was entered", () => {
    expect(formatEnteredPurchaseMoney("EGP", null, 80, "en")).toBe("EGP 80.00");
    expect(formatEnteredPurchaseMoney("SAR", 10, 135, "en")).toBe("SAR 10.00");
    expect(formatEnteredPurchaseMoney(null, 10, 135, "en")).toBe("SAR 10.00");
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
