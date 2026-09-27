import type { Pass, Resort } from "./schema";

/** Average adult day ticket over the resorts a pass covers. Resorts without a price are skipped. */
export function averageDayTicket(pass: Pick<Pass, "id">, resorts: Array<Pick<Resort, "passes" | "abandoned" | "day_ticket_eur">>): { eur: number; resorts: number } | null {
  const prices = resorts
    .filter((resort) => !resort.abandoned && resort.passes.includes(pass.id))
    .map((resort) => resort.day_ticket_eur)
    .filter((price): price is number => price != null && Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return { eur: prices.reduce((sum, price) => sum + price, 0) / prices.length, resorts: prices.length };
}

/** Ski days at which the pass costs the same as buying day tickets. */
export function breakEvenDays(passEur: number | null, dayEur: number | null): number | null {
  if (passEur == null || dayEur == null || !(dayEur > 0) || !(passEur >= 0)) return null;
  return passEur / dayEur;
}

/** Positive: the pass saves this much over day tickets for `days` days. Negative: day tickets are cheaper. */
export function passSavings(passEur: number, dayEur: number, days: number): number {
  return Math.round(dayEur * days - passEur);
}

export type PassSort = "price" | "resorts" | "name";

export function sortPasses<T>(items: T[], sort: PassSort, key: (item: T) => { price: number | null; resorts: number; name: string }): T[] {
  return [...items].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    if (sort === "resorts") return y.resorts - x.resorts || x.name.localeCompare(y.name);
    if (sort === "name") return x.name.localeCompare(y.name);
    return (x.price ?? Number.POSITIVE_INFINITY) - (y.price ?? Number.POSITIVE_INFINITY) || x.name.localeCompare(y.name);
  });
}
