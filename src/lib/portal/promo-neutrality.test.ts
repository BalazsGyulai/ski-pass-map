import { describe, expect, it } from "vitest";
import { resorts } from "@/lib/data";
import { promoNeutralityCheck } from "./promo-neutrality";

describe("promo ranking neutrality", () => {
  it("does not change filter/sort output when promos exist", () => {
    const filters = {
      q: "",
      passes: [],
      passMatch: "any" as const,
      noPass: false,
      regions: [],
      transit: false,
      park: false,
      night: false,
      minElev: null,
      minSlope: null,
      maxKm: null,
      favouritesOnly: false,
      showAbandoned: false,
    };
    const context = { home: null, favourites: new Set<string>(), passNames: new Map<string, string>() };
    const promos = [{ resortId: resorts[0]?.id ?? "x", text: "Promo", linkUrl: null, logoUrl: null, resortName: "Test" }];
    expect(promoNeutralityCheck(resorts.slice(0, 40), filters, context, promos)).toBe(true);
  });
});
