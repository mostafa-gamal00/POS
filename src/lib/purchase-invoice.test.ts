import { describe, expect, it } from "vitest";
import { quotePurchaseInvoice, type PurchaseQuoteInput } from "./purchase-invoice";

function quote(input: PurchaseQuoteInput) {
  return quotePurchaseInvoice(input);
}

describe("quotePurchaseInvoice", () => {
  it("converts a SAR line with the invoice rate and leaves an EGP line unchanged", () => {
    const result = quote({
      invoiceTotalSar: "15",
      exchangeRate: "10",
      transportSar: "0",
      lines: [
        { qty: 1, unitPrice: "10", currency: "SAR" },
        { qty: 1, unitPrice: "50", currency: "EGP" },
      ],
    });
    expect(result.lines[0]?.goodsUnitCents).toBe(10_000);
    expect(result.lines[1]?.goodsUnitCents).toBe(5_000);
    expect(result.isBalanced).toBe(true);
  });

  it("gives two units twice the transportation of one unit", () => {
    const result = quote({
      invoiceTotalSar: "30",
      exchangeRate: "10",
      transportSar: "3",
      lines: [
        { qty: 1, unitPrice: "9", currency: "SAR" },
        { qty: 2, unitPrice: "9", currency: "SAR" },
      ],
    });
    expect(result.lines[0]?.transportCents).toBe(1_000);
    expect(result.lines[1]?.transportCents).toBe(2_000);
    expect(result.lines[1]?.transportPerUnitCents).toBe(1_000);
    expect(result.isBalanced).toBe(true);
  });

  it("keeps a leftover cent on the last unit and still matches the invoice", () => {
    const result = quote({
      invoiceTotalSar: "2.01",
      exchangeRate: "1",
      transportSar: "0.01",
      lines: [
        { qty: 1, unitPrice: "1", currency: "EGP" },
        { qty: 1, unitPrice: "1", currency: "EGP" },
      ],
    });
    expect(result.lines[0]?.transportCents).toBe(0);
    expect(result.lines[1]?.extraCents).toBe(1);
    expect(result.lines[1]?.unitCostCents).toBe(101);
    expect(result.lines[0]?.lineTotalCents).toBe(100);
    expect(result.lines[1]?.lineTotalCents).toBe(101);
    expect(result.invoiceTotalEgpCents).toBe(201);
    expect(result.isBalanced).toBe(true);
  });

  it("puts an uneven cent on the last unit of a longer line without losing it", () => {
    const result = quote({
      invoiceTotalSar: "10",
      exchangeRate: "1",
      transportSar: "0.10",
      lines: [{ qty: 3, unitPrice: "3.30", currency: "EGP" }],
    });
    expect(result.lines[0]?.transportPerUnitCents).toBe(3);
    expect(result.lines[0]?.extraCents).toBe(1);
    expect(result.lines[0]?.unitCostCents).toBe(333);
    expect(result.lines[0]?.lineTotalCents).toBe(1_000);
    expect(result.isBalanced).toBe(true);
  });

  it("reports a gap and does not call the invoice balanced", () => {
    const short = quote({
      invoiceTotalSar: "100",
      exchangeRate: "1",
      transportSar: "0",
      lines: [{ qty: 1, unitPrice: "90", currency: "EGP" }],
    });
    expect(short.gapCents).toBe(1_000);
    expect(short.isBalanced).toBe(false);
    const over = quote({
      invoiceTotalSar: "100",
      exchangeRate: "1",
      transportSar: "0",
      lines: [{ qty: 1, unitPrice: "110", currency: "EGP" }],
    });
    expect(over.gapCents).toBe(-1_000);
    expect(over.isBalanced).toBe(false);
  });

  it("allows zero transportation when the goods already equal the invoice", () => {
    const result = quote({
      invoiceTotalSar: "100",
      exchangeRate: "1",
      transportSar: "0",
      lines: [{ qty: 1, unitPrice: "100", currency: "EGP" }],
    });
    expect(result.transportEgpCents).toBe(0);
    expect(result.lines[0]?.unitCostCents).toBe(10_000);
    expect(result.isBalanced).toBe(true);
  });

  it("mixes EGP and SAR lines on one invoice", () => {
    const result = quote({
      invoiceTotalSar: "20",
      exchangeRate: "10",
      transportSar: "2",
      lines: [
        { qty: 1, unitPrice: "10", currency: "SAR" },
        { qty: 1, unitPrice: "80", currency: "EGP" },
      ],
    });
    expect(result.lines[0]?.goodsUnitCents).toBe(10_000);
    expect(result.lines[1]?.goodsUnitCents).toBe(8_000);
    expect(result.lines[0]?.transportCents).toBe(1_000);
    expect(result.lines[1]?.transportCents).toBe(1_000);
    expect(result.lines[0]?.unitCostCents).toBe(11_000);
    expect(result.paidEgpCents).toBe(result.invoiceTotalEgpCents);
    expect(result.isBalanced).toBe(true);
  });

  it("rounds half a cent up when converting SAR to EGP", () => {
    const result = quote({
      invoiceTotalSar: "1.25",
      exchangeRate: "13.5",
      transportSar: "0",
      lines: [{ qty: 1, unitPrice: "16.88", currency: "EGP" }],
    });
    expect(result.invoiceTotalEgpCents).toBe(1_688);
    expect(result.isBalanced).toBe(true);
    expect(result.invoiceTotalSar).toBe("1.25");
    expect(result.exchangeRate).toBe("13.5");
  });
});
