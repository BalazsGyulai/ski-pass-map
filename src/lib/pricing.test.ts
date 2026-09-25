import { describe, expect, it } from "vitest";
import { passes, resorts } from "./data";
import { daysUntil } from "./format";
import {
  cheapestFullCoverage,
  dayTicketIsEstimate,
  deadlinesFor,
  distributeDays,
  pricesOnDate,
  quotePlan,
  resolvePrice,
  type PricedResort,
} from "./pricing";
import type { Pass } from "./schema";

const pass = (id: string) => {
  const found = passes.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("resolvePrice", () => {
  it("does not guess Bergerlebnispass adult or child from a birth year", () => {
    const bep = pass("bergerlebnispass");
    expect(resolvePrice(bep, 2003, "2026-10-31").reason).toBe("age-not-birth-year");
    expect(resolvePrice(bep, null, "2026-10-01").reason).toBe("no-birth-year");
    const early = pricesOnDate(bep, "2026-10-31");
    expect(early.find((row) => row.bracketLabel.startsWith("Adult"))?.amountEur).toBe(429);
    expect(early.find((row) => row.bracketLabel.startsWith("Child"))?.amountEur).toBe(170);
    const later = pricesOnDate(bep, "2026-12-01");
    expect(later.find((row) => row.bracketLabel.startsWith("Adult"))?.amountEur).toBe(555);
    expect(later.find((row) => row.bracketLabel.startsWith("Child"))?.amountEur).toBe(300);
  });

  it("selects Ostalpen tariffs on the published birth-year bounds", () => {
    const oac = pass("ostalpen");
    expect(resolvePrice(oac, 2000, "2026-12-01").amountEur).toBe(587);
    expect(resolvePrice(oac, 2006, "2026-12-01").amountEur).toBe(587);
    expect(resolvePrice(oac, 2007, "2026-12-01")).toMatchObject({ amountEur: 587, bracketLabel: "Youth" });
    expect(resolvePrice(oac, 1999, "2027-02-01").amountEur).toBe(773);
    expect(resolvePrice(oac, 2011, "2026-12-01").amountEur).toBe(399);
    expect(resolvePrice(oac, 2020, "2026-12-01").reason).toBe("no-bracket");
  });

  it("keeps Snow Card unknown until the presale named in the price note", () => {
    const tsc = pass("snowcardtirol");
    const before = resolvePrice(tsc, 2003, "2026-09-25");
    expect(before.amountEur).toBeNull();
    expect(before.reason).toBe("no-period");
    expect(before.nextPeriodStart).toBe("2026-09-26");
    expect(resolvePrice(tsc, 2003, "2026-09-26").amountEur).toBe(1080);
    expect(resolvePrice(tsc, 2003, "2026-10-31").amountEur).toBe(1080);
    expect(resolvePrice(tsc, 2003, "2026-11-01").amountEur).toBe(1227);
    expect(resolvePrice(tsc, 2009, "2026-10-01").amountEur).toBe(658);
    expect(resolvePrice(tsc, 2021, "2026-11-01").reason).toBe("no-bracket");
  });

  it("steps Joker and Mur-Mürz, and uses the SuperSkiCard 18+ price only after 3 Dec", () => {
    expect(resolvePrice(pass("joker"), 2003, "2026-12-03").amountEur).toBe(837);
    expect(resolvePrice(pass("joker"), 1990, "2026-12-03").amountEur).toBe(1148);
    expect(resolvePrice(pass("joker"), 2003, "2026-12-04").amountEur).toBe(923);
    expect(resolvePrice(pass("superskicard"), 2002, "2026-12-03").amountEur).toBe(890);
    expect(resolvePrice(pass("superskicard"), 1990, "2026-12-03").amountEur).toBe(1049);
    expect(resolvePrice(pass("superskicard"), 2002, "2026-12-04")).toMatchObject({
      amountEur: 1190,
      bracketLabel: "Everyone 18+ (from 2026-12-04)",
    });
    expect(resolvePrice(pass("superskicard"), 2012, "2026-12-04").reason).toBe("no-bracket");
    expect(pricesOnDate(pass("superskicard"), "2026-10-01").find((row) => row.bracketLabel.includes("18+"))?.reason).toBe(
      "no-period",
    );
    expect(resolvePrice(pass("murmuerz"), 1999, "2026-12-15").amountEur).toBe(610);
    expect(resolvePrice(pass("murmuerz"), 1999, "2026-12-16").amountEur).toBe(671);
    expect(resolvePrice(pass("murmuerz"), 1997, "2027-01-10").amountEur).toBe(919);
  });
});

describe("deadlinesFor", () => {
  it("includes the Snow Card presale start and the shared cut-off dates", () => {
    const snow = deadlinesFor(pass("snowcardtirol"));
    expect(snow.find((event) => event.date === "2026-09-26")?.kind).toBe("starts");
    expect(snow.find((event) => event.date === "2026-10-31")?.kind).toBe("ends");
    const card = deadlinesFor(pass("superskicard"));
    expect(card.find((event) => event.date === "2026-12-03")?.kind).toBe("ends");
    expect(card.find((event) => event.date === "2026-12-04")?.kind).toBe("starts");
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

  it("prices Ostalpen plus Snow Card and leaves the day-ticket total unknown without an official day ticket", () => {
    const quotes = quotePlan(passes, slim, 2003, "2026-10-01", [
      { id: "stuhleck", days: 4 },
      { id: "stubaier-gletscher", days: 7 },
    ]);
    const combo = quotes.find((quote) => quote.id === "combo:ostalpen+snowcardtirol");
    expect(combo).toMatchObject({
      passPriceEur: 587 + 1080,
      coveredDays: 11,
      uncoveredDays: 0,
      totalEur: 1667,
      usesEstimate: false,
      breakEvenEstimate: false,
      breakEvenDays: null,
    });
    expect(quotes.find((quote) => quote.id === "pass:ostalpen")?.uncoveredDays).toBe(7);
    expect(quotes.find((quote) => quote.id === "pass:snowcardtirol")?.coveredDays).toBe(7);
    expect(quotes.find((quote) => quote.id === "pass:bergerlebnispass")?.priceReason).toBe("age-not-birth-year");
    const tickets = quotes.find((quote) => quote.id === "day-tickets");
    expect(tickets?.totalEur).toBeNull();
    expect(tickets?.usesEstimate).toBe(false);
    expect(cheapestFullCoverage(quotes)?.id).toBe("combo:ostalpen+snowcardtirol");
  });

  it("prices day tickets and break-even when every used resort has a day-ticket price", () => {
    const fixturePasses: Pass[] = [
      {
        ...pass("bergerlebnispass"),
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
