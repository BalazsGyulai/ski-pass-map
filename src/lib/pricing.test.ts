import { describe, expect, it } from "vitest";
import { passes, resorts } from "./data";
import { daysUntil } from "./format";
import { cheapestFullCoverage, distributeDays, quotePlan, resolvePrice, type PricedResort } from "./pricing";
import type { Pass } from "./schema";

const pass = (id: string) => {
  const found = passes.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("resolvePrice", () => {
  it("applies Bergerlebnispass date steps and refuses a child tariff", () => {
    const bep = pass("bep");
    expect(resolvePrice(bep, 2003, "2026-10-31").amountEur).toBe(429);
    expect(resolvePrice(bep, 1990, "2026-11-01").amountEur).toBe(500);
    expect(resolvePrice(bep, 2003, "2026-11-30").amountEur).toBe(500);
    expect(resolvePrice(bep, 2003, "2026-12-01").amountEur).toBe(555);
    expect(resolvePrice(bep, 2012, "2026-10-01")).toMatchObject({ amountEur: null, reason: "price-unknown", bracketId: "child" });
    expect(resolvePrice(bep, null, "2026-10-01").reason).toBe("no-birth-year");
  });

  it("selects Ostalpen U25 and adult on the birth-year boundary", () => {
    const oac = pass("oac");
    expect(resolvePrice(oac, 2002, "2026-12-01").amountEur).toBe(587);
    expect(resolvePrice(oac, 2010, "2026-12-01").amountEur).toBe(587);
    expect(resolvePrice(oac, 2001, "2026-12-01").amountEur).toBe(773);
    expect(resolvePrice(oac, 1990, "2027-02-01").amountEur).toBe(773);
    expect(resolvePrice(oac, 2011, "2026-12-01").amountEur).toBeNull();
  });

  it("keeps Snow Card unknown until the presale, then steps the price", () => {
    const tsc = pass("tsc");
    const before = resolvePrice(tsc, 2003, "2026-09-25");
    expect(before.amountEur).toBeNull();
    expect(before.reason).toBe("no-period");
    expect(before.nextPeriodStart).toBe("2026-09-26");
    expect(resolvePrice(tsc, 1990, "2026-09-26").amountEur).toBe(1080);
    expect(resolvePrice(tsc, 2003, "2026-10-31").amountEur).toBe(1080);
    expect(resolvePrice(tsc, 2003, "2026-11-01").amountEur).toBe(1227);
  });

  it("drops Joker and SuperSkiCard prices after 3 Dec and steps Mur-Mürz U28", () => {
    expect(resolvePrice(pass("sj"), 2003, "2026-12-03").amountEur).toBe(837);
    expect(resolvePrice(pass("sj"), 1990, "2026-12-03").amountEur).toBe(1148);
    expect(resolvePrice(pass("sj"), 2003, "2026-12-04").amountEur).toBeNull();
    expect(resolvePrice(pass("ssc"), 2002, "2026-12-03").amountEur).toBe(890);
    expect(resolvePrice(pass("ssc"), 1990, "2026-12-03").amountEur).toBe(1049);
    expect(resolvePrice(pass("ssc"), 2002, "2026-12-04").reason).toBe("price-unknown");
    expect(resolvePrice(pass("mmt"), 1999, "2026-12-15").amountEur).toBe(610);
    expect(resolvePrice(pass("mmt"), 1999, "2026-12-16").amountEur).toBe(671);
    expect(resolvePrice(pass("mmt"), 1998, "2027-01-10").amountEur).toBe(835);
  });
});

describe("quotePlan", () => {
  const slim = resorts.map((resort) => ({
    id: resort.id,
    name: resort.name,
    region: resort.region,
    passes: resort.passes,
    dayTicketEur: resort.day_ticket_eur,
  }));

  it("recommends Ostalpen plus Snow Card when east and Tirol days are both planned", () => {
    const quotes = quotePlan(passes, slim, 2003, "2026-10-01", [
      { id: "stuhleck", days: 4 },
      { id: "stubaier-gletscher", days: 7 },
    ]);
    const combo = quotes.find((quote) => quote.id === "combo:oac+tsc");
    expect(combo).toMatchObject({ passPriceEur: 587 + 1080, coveredDays: 11, uncoveredDays: 0, totalEur: 1667 });
    expect(quotes.find((quote) => quote.id === "pass:oac")?.uncoveredDays).toBe(7);
    expect(quotes.find((quote) => quote.id === "pass:tsc")?.coveredDays).toBe(7);
    expect(quotes.some((quote) => quote.id === "combo:bep+tsc")).toBe(false);
    expect(cheapestFullCoverage(quotes)?.id).toBe("combo:oac+tsc");
    expect(quotes.find((quote) => quote.id === "day-tickets")?.totalEur).toBeNull();
  });

  it("prices day tickets and break-even when every used resort has a day-ticket price", () => {
    const fixturePasses: Pass[] = [
      {
        ...pass("bep"),
        id: "local",
        pricing: {
          assumptions: "fixture",
          brackets: [
            {
              id: "adult",
              label: "Adult",
              min_birth_year: null,
              max_birth_year: null,
              periods: [{ id: "flat", label: "Flat", start: null, end: null, price_eur: 100 }],
            },
          ],
        },
        deadlines: [],
      },
    ];
    const hills: PricedResort[] = [
      { id: "near", name: "Near", region: "Lower Austria", passes: ["local"], dayTicketEur: 40 },
      { id: "far", name: "Far", region: "Tirol", passes: [], dayTicketEur: 60 },
    ];
    const quotes = quotePlan(fixturePasses, hills, 1990, "2026-10-01", [
      { id: "near", days: 2 },
      { id: "far", days: 1 },
    ]);
    const local = quotes.find((quote) => quote.id === "pass:local");
    expect(local).toMatchObject({
      passPriceEur: 100,
      coveredDays: 2,
      uncoveredDays: 1,
      uncoveredDayTicketEur: 60,
      totalEur: 160,
      breakEvenDays: 2.5,
    });
    expect(quotes.find((quote) => quote.id === "day-tickets")?.totalEur).toBe(140);
    expect(cheapestFullCoverage(quotes)?.id).toBe("day-tickets");
  });
});

describe("distributeDays", () => {
  it("gives the remainder to the first resorts and skips duplicates", () => {
    expect(distributeDays(["a", "b", "a", "c"], 10)).toEqual({ a: 4, b: 3, c: 3 });
    expect(distributeDays(["near", "far", "farther"], 2)).toEqual({ near: 1, far: 1 });
    expect(distributeDays([], 5)).toEqual({});
  });
});

describe("daysUntil", () => {
  it("counts calendar days without timezone drift", () => {
    expect(daysUntil("2026-09-25", "2026-10-31")).toBe(36);
    expect(daysUntil("2026-09-25", "2026-09-26")).toBe(1);
    expect(daysUntil("2026-09-25", "2026-09-25")).toBe(0);
  });
});
