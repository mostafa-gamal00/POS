import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("escapes commas and quotes and keeps Arabic text", () => {
    const csv = toCsv(
      ["Name", "Note"],
      [['Tea, "special"', "شاي"]],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Tea, ""special"""');
    expect(csv).toContain("شاي");
  });
});
