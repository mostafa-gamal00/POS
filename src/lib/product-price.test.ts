import { describe, expect, it } from "vitest";
import { convertProductPrice, formatProductMoney } from "./product-price";

describe("convertProductPrice", () => {
  it("copies an EGP amount and drops the rate", () => {
    expect(
      convertProductPrice({ currency: "EGP", enteredPrice: "12.5", exchangeRate: "10" }),
    ).toEqual({
      currency: "EGP",
      enteredPrice: "12.5",
      exchangeRate: null,
      price: "12.5",
    });
  });

  it("rounds a half cent up before storing an EGP price", () => {
    expect(
      convertProductPrice({ currency: "EGP", enteredPrice: "1.005", exchangeRate: "" }),
    ).toMatchObject({ price: "1.01", enteredPrice: "1.01" });
  });

  it("converts SAR with half-away-from-zero cent rounding", () => {
    expect(
      convertProductPrice({ currency: "SAR", enteredPrice: "10", exchangeRate: "12.5" }),
    ).toMatchObject({ price: "125", exchangeRate: "12.5" });
    expect(
      convertProductPrice({ currency: "SAR", enteredPrice: "1.25", exchangeRate: "0.1" }),
    ).toMatchObject({ price: "0.13" });
  });

  it("rejects a missing or non-positive SAR rate", () => {
    expect(
      convertProductPrice({ currency: "SAR", enteredPrice: "10", exchangeRate: "" }),
    ).toBeNull();
    expect(
      convertProductPrice({ currency: "SAR", enteredPrice: "10", exchangeRate: "0" }),
    ).toBeNull();
  });

  it("rejects a price that is not a number", () => {
    expect(
      convertProductPrice({ currency: "EGP", enteredPrice: "-1", exchangeRate: "" }),
    ).toBeNull();
  });
});

describe("formatProductMoney", () => {
  it("labels an EGP selling price and shows a SAR entry beside the converted amount", () => {
    expect(formatProductMoney({ price: 12.5, price_currency: "EGP" }, "en")).toBe("EGP 12.50");
    expect(
      formatProductMoney(
        { price: 125, price_currency: "SAR", entered_price: 10 },
        "en",
      ),
    ).toBe("SAR 10.00 · EGP 125.00");
    expect(formatProductMoney({ price: 12.5, price_currency: "EGP" }, "ar")).toBe("12.50 ج.م");
  });
});
