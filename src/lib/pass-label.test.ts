import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { passes } from "./data";
import { passHasShortName, passShortName } from "./pass-label";

describe("passShortName", () => {
  it("uses the curated label and falls back to the official name", () => {
    expect(passShortName({ id: "noe-bergerlebnispass", name: "official" })).toBe("NÖ Bergerlebnis");
    expect(passShortName({ id: "snow-card-tirol", name: "official" })).toBe("Snow Card Tirol");
    expect(passShortName({ id: "ski-amade-all-in-card-white", name: "official" })).toBe("Ski amadé");
    expect(passShortName({ id: "steiermark-joker", name: "Steiermark Joker" })).toBe("Joker");
    expect(passShortName({ id: "not-in-config", name: "Full official name" })).toBe("Full official name");
    expect(passHasShortName({ id: "not-in-config", name: "Full official name" })).toBe(false);
    expect(passHasShortName({ id: "ski-amade-all-in-card-white", name: "Ski amadé" })).toBe(false);
  });

  it("covers every published pass and stays outside the Austria import", () => {
    for (const pass of passes) {
      expect(passShortName(pass).length).toBeGreaterThan(0);
    }
    const script = readFileSync(new URL("../../scripts/import-austria.ts", import.meta.url), "utf8");
    expect(script).not.toContain("pass-labels");
    expect(script).toContain("data/passes.json");
  });
});
