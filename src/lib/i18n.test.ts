import { describe, expect, it } from "vitest";
import { ar, en, fill } from "./i18n";

describe("messages", () => {
  it("gives Arabic every English key", () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it("fills placeholders", () => {
    expect(fill(en.left, { count: 3 })).toBe("3 left");
  });
});
