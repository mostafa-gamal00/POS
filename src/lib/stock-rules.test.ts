import { describe, expect, it } from "vitest";
import { checkAddQty, checkCheckout } from "./stock-rules";

describe("checkAddQty", () => {
  it("allows a quantity within stock", () => {
    expect(checkAddQty(1, 3, "Tea")).toEqual({ ok: true });
  });

  it("rejects a quantity above stock", () => {
    expect(checkAddQty(2, 2, "Tea")).toEqual({
      ok: false,
      message: "Not enough stock for Tea",
    });
  });

  it("rejects an out-of-stock product", () => {
    expect(checkAddQty(0, 0, "Tea")).toEqual({
      ok: false,
      message: "Tea is out of stock",
    });
  });
});

describe("checkCheckout", () => {
  it("rejects an empty cart", () => {
    expect(checkCheckout([])).toEqual({
      ok: false,
      message: "Cart is empty",
    });
  });

  it("rejects a zero or negative line quantity", () => {
    expect(
      checkCheckout([{ qty: 0, stockQty: 5, name: "Tea" }]),
    ).toEqual({
      ok: false,
      message: "Quantity must be greater than zero",
    });
    expect(
      checkCheckout([{ qty: -1, stockQty: 5, name: "Tea" }]),
    ).toEqual({
      ok: false,
      message: "Quantity must be greater than zero",
    });
  });

  it("rejects a line above available stock", () => {
    expect(
      checkCheckout([{ qty: 4, stockQty: 3, name: "Tea" }]),
    ).toEqual({
      ok: false,
      message: "Not enough stock for Tea",
    });
  });

  it("accepts a cart that fits stock", () => {
    expect(
      checkCheckout([{ qty: 2, stockQty: 3, name: "Tea" }]),
    ).toEqual({ ok: true });
  });
});
