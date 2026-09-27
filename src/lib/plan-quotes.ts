import { passById, passes, resorts } from "./data";
import { passShortName } from "./pass-label";
import { dayTicketIsEstimate, quotePlan, savingsVsDayTickets, type PriceQuote } from "./pricing";

/** Quotes for the planned days: each pass, two-pass combinations, and day tickets only. */
export function planQuotes(birthYear: number | null, effectiveDate: string, resortDays: Record<string, number>): PriceQuote[] {
  return quotePlan(
    passes,
    resorts.map((resort) => ({
      id: resort.id,
      name: resort.name,
      region: resort.region,
      passes: resort.passes,
      dayTicketEur: resort.day_ticket_eur,
      dayTicketEstimate: dayTicketIsEstimate(resort.day_ticket_season, resort.day_ticket_eur),
    })),
    birthYear,
    effectiveDate,
    Object.entries(resortDays).map(([id, days]) => ({ id, days })),
  );
}

/** Cheapest priced option for the plan, and what it saves over day tickets. */
export function bestPlanOption(quotes: PriceQuote[]): { best: PriceQuote | null; savings: number | null } {
  const priced = quotes.filter((quote) => quote.totalEur != null).sort((a, b) => (a.totalEur ?? 0) - (b.totalEur ?? 0));
  const best = priced[0] ?? null;
  const dayTickets = quotes.find((quote) => quote.kind === "day-tickets");
  return { best, savings: best && dayTickets ? savingsVsDayTickets(best, dayTickets) : null };
}

export function quoteTitle(quote: PriceQuote, t: (key: "dayTicketsOnly" | "combo", vars?: Record<string, string | number>) => string): string {
  if (quote.kind === "day-tickets") return t("dayTicketsOnly");
  const names = quote.passIds.map((id) => {
    const pass = passById.get(id);
    return pass ? passShortName(pass) : id;
  });
  return quote.kind === "combo" ? `${t("combo")}: ${names.join(" + ")}` : names.join(" + ");
}
