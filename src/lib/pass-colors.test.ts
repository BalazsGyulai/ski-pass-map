import { describe, expect, it } from "vitest";
import curated from "../../config/pass-colors.json";
import { passColor, passes } from "./data";

describe("curated pass colours", () => {
  it("gives every published pass its own valid colour", () => {
    const colors = passes.map((pass) => pass.color.toLowerCase());
    for (const pass of passes) {
      expect(pass.color, pass.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect((curated as Record<string, string>)[pass.id], `${pass.id} has no curated colour`).toBeTruthy();
    }
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("uses the curated colour and falls back to the imported one", () => {
    expect(passColor({ id: "snow-card-tirol", color: "#000000" })).toBe("#2f6fed");
    expect(passColor({ id: "not-a-pass", color: "#123456" })).toBe("#123456");
  });

  it("keeps curated colours unique", () => {
    const values = Object.values(curated as Record<string, string>).map((value) => value.toLowerCase());
    expect(new Set(values).size).toBe(values.length);
  });
});
