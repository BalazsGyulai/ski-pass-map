import { describe, expect, it } from "vitest";
import { passes, resorts } from "./data";
import { daysUntil } from "./format";
import {
  cheapestFullCoverage,
  dayTicketIsEstimate,
  deadlinesFor,
  distributeDays,
  adultBracket,
  nextPriceChange,
  pricesOnDate,
  quotePlan,
  resolveForViewer,
  resolvePrice,
  savingsVsDayTickets,
  type PricedResort,
  type PriceQuote,
} from "./pricing";
import type { Pass } from "./schema";

const pass = (id: string) => {
  const found = passes.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("resolvePrice", () => {
  it("does not guess an age-at-purchase pass from a birth year", () => {
    const bep = pass("noe-bergerlebnispass");
    expect(resolvePrice(bep, 2003, "2026-10-31").reason).toBe("age-not-birth-year");
    expect(resolvePrice(bep, 1990, "2026-12-01").reason).toBe("age-not-birth-year");
    expect(resolvePrice(bep, null, "2026-10-01").reason).toBe("no-birth-year");
    const early = pricesOnDate(bep, "2026-10-31");
    expect(early.find((row) => row.bracketLabel.startsWith("adult"))?.amountEur).toBe(429);
    expect(early.find((row) => row.bracketLabel.startsWith("child"))?.amountEur).toBe(170);
    const november = pricesOnDate(bep, "2026-11-15");
    expect(november.find((row) => row.bracketLabel.startsWith("adult"))?.amountEur).toBe(500);
    const later = pricesOnDate(bep, "2026-12-01");
    expect(later.find((row) => row.bracketLabel.startsWith("adult"))?.amountEur).toBe(555);
    expect(later.find((row) => row.bracketLabel.startsWith("child"))?.amountEur).toBe(300);
  });

  it("prices Snow Card and SuperSkiCard from birth year and purchase date", () => {
    const tsc = pass("snow-card-tirol");
    const before = resolvePrice(tsc, 2003, "2026-09-25");
    expect(before.amountEur).toBeNull();
    expect(before.reason).toBe("no-period");
    expect(before.nextPeriodStart).toBe("2026-09-26");
    expect(resolvePrice(tsc, 2003, "2026-09-26").amountEur).toBe(1080);
    expect(resolvePrice(tsc, 1990, "2026-10-31").amountEur).toBe(1080);
    expect(resolvePrice(tsc, 2003, "2026-11-01").amountEur).toBe(1227);
    expect(resolvePrice(tsc, 1990, "2026-11-01").amountEur).toBe(1227);
    expect(resolvePrice(tsc, 2009, "2026-10-01").amountEur).toBe(658);
    expect(resolvePrice(tsc, 2021, "2026-11-01").reason).toBe("no-bracket");

    const card = pass("superskicard-premium");
    expect(resolvePrice(card, 2002, "2026-12-03").amountEur).toBe(890);
    expect(resolvePrice(card, 2002, "2026-12-04").amountEur).toBe(1190);
    expect(resolvePrice(card, 1990, "2026-12-03").amountEur).toBe(1049);
    expect(resolvePrice(card, 1990, "2026-12-04").amountEur).toBe(1190);
    expect(resolvePrice(card, 2021, "2026-12-04").reason).toBe("no-bracket");
  });

  it("uses the provisional Ski Arlberg early-bird window", () => {
    const arlberg = pass("ski-arlberg-saisonkarte");
    expect(arlberg.provisional).toBe(true);
    expect(resolvePrice(arlberg, 1990, "2026-11-26").reason).toBe("no-period");
    expect(resolvePrice(arlberg, 1990, "2026-12-10").amountEur).toBe(840);
    expect(resolvePrice(arlberg, 2003, "2026-12-11").amountEur).toBe(1272);
    expect(resolvePrice(arlberg, 2019, "2026-12-11").amountEur).toBe(11);
  });
});

describe("resolveForViewer", () => {
  it("prices the adult tariff without a birth year, and keeps a birth year exact", () => {
    const bep = pass("noe-bergerlebnispass");
    expect(resolveForViewer(bep, null, "2026-10-01").amountEur).toBe(429);
    expect(resolveForViewer(bep, null, "2026-11-15").amountEur).toBe(500);
    expect(resolveForViewer(bep, null, "2026-10-01").bracketLabel?.startsWith("adult")).toBe(true);
    expect(pricesOnDate(bep, "2026-10-01").find((row) => row.bracketLabel.startsWith("child"))?.amountEur).toBe(170);
    expect(resolveForViewer(bep, 2003, "2026-10-01").reason).toBe("age-not-birth-year");

    const snow = pass("snow-card-tirol");
    expect(resolveForViewer(snow, null, "2026-10-01").amountEur).toBe(1080);
    expect(resolveForViewer(snow, 1990, "2026-10-01").amountEur).toBe(1080);
    expect(resolveForViewer(snow, 2003, "2026-10-01").amountEur).toBe(1080);
    expect(resolveForViewer(snow, 1990, "2026-11-15").amountEur).toBe(1227);
    expect(resolveForViewer(snow, 2003, "2026-11-15").amountEur).toBe(1227);
    const three = pass("3taelerpass-saisonkarte");
    expect(resolveForViewer(three, null, "2026-12-11").bracketLabel?.startsWith("Erwachsene")).toBe(true);
    expect(resolveForViewer(three, 2012, "2026-12-11").bracketLabel).toMatch(/Schüler I/);
  });

  it("uses one adult label and does not guess when that label is missing or repeated", () => {
    for (const item of passes) {
      expect(adultBracket(item), item.id).not.toBeNull();
    }
  });
});

describe("nextPriceChange", () => {
  it("reads the next published cut-off for the adult tariff when no birth year is set", () => {
    const bep = pass("noe-bergerlebnispass");
    expect(nextPriceChange(bep, null, "2026-10-01")).toMatchObject({
      date: "2026-10-31",
      fromEur: 429,
      toEur: 500,
    });
    expect(nextPriceChange(bep, 1990, "2026-10-01")).toBeNull();
  });
});

describe("savingsVsDayTickets", () => {
  it("subtracts the option total from day tickets", () => {
    const day = { totalEur: 1171.5 } as PriceQuote;
    const best = { totalEur: 987 } as PriceQuote;
    expect(savingsVsDayTickets(best, day)).toBeCloseTo(184.5);
    expect(savingsVsDayTickets({ totalEur: null } as PriceQuote, day)).toBeNull();
  });
});

describe("deadlinesFor", () => {
  it("includes the Snow Card presale start and the shared cut-off dates", () => {
    const snow = deadlinesFor(pass("snow-card-tirol"));
    expect(snow.find((event) => event.date === "2026-09-26")?.kind).toBe("starts");
    expect(snow.find((event) => event.date === "2026-10-31")?.kind).toBe("ends");
    const card = deadlinesFor(pass("superskicard-premium"));
    expect(card.find((event) => event.date === "2026-12-03")?.kind).toBe("ends");
    expect(card.find((event) => event.date === "2026-12-03")?.label).toContain("890");
  });
});

describe("quotePlan", () => {
  const slim = resorts.map((resort) => ({
    id: resort.id,
    name: resort.name,
    region: resort.region,
    passes: resort.passes,
    dayTicketEur: resort.day_ticket_eur,
    dayTicketEstimate: dayTicketIsEstimate(resort.day_ticket_season, resort.day_ticket_eur),
  }));

  it("prices Snow Card plus Ski amadé from birth year, and leaves a missing bracket unavailable", () => {
    const snowId = "snow-card-tirol";
    const amadeId = "ski-amade-all-in-card-white";
    const tirol = resorts.find((resort) => resort.passes.includes(snowId) && !resort.passes.includes(amadeId) && resort.day_ticket_eur == null);
    const amade = resorts.find((resort) => resort.passes.includes(amadeId) && !resort.passes.includes(snowId) && resort.day_ticket_eur == null);
    if (!tirol || !amade) throw new Error("expected a Snow Card resort and a Ski amadé resort without day tickets");
    const quotes = quotePlan(passes, slim, 2003, "2026-10-01", [
      { id: amade.id, days: 4 },
      { id: tirol.id, days: 7 },
    ]);
    const combo = quotes.find((quote) => quote.id === `combo:${amadeId}+${snowId}` || quote.id === `combo:${snowId}+${amadeId}`);
    expect(combo).toMatchObject({
      passPriceEur: 601 + 1080,
      coveredDays: 11,
      uncoveredDays: 0,
      totalEur: 1681,
    });
    expect(quotes.find((quote) => quote.id === `pass:${snowId}`)?.coveredDays).toBe(7);
    expect(quotes.find((quote) => quote.id === `pass:${amadeId}`)?.coveredDays).toBe(4);
    expect(quotes.find((quote) => quote.id === "pass:noe-bergerlebnispass")?.priceReason).toBe("age-not-birth-year");
    expect(quotes.find((quote) => quote.id === "day-tickets")?.totalEur).toBeNull();
  });

  it("prices day tickets and break-even when every used resort has a day-ticket price", () => {
    const fixturePasses: Pass[] = [
      {
        ...passes[0],
        id: "local",
        pricing: {
          brackets: [{ label: "Adult", birth_year_from: null, birth_year_to: null }],
          periods: [
            {
              bracket: "Adult",
              price_eur: 100,
              valid_until: null,
              source: { sourceUrl: "https://example.com/pass", checkedAt: "2026-09-25" },
            },
          ],
        },
      },
    ];
    const hills: PricedResort[] = [
      { id: "near", name: "Near", region: "Lower Austria", passes: ["local"], dayTicketEur: 40, dayTicketEstimate: false },
      { id: "far", name: "Far", region: "Tirol", passes: [], dayTicketEur: 60, dayTicketEstimate: false },
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
      usesEstimate: false,
      breakEvenEstimate: false,
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
