import type { Pass, PricePeriod } from "./schema";

export type PriceReason = "ok" | "no-birth-year" | "no-bracket" | "no-period" | "price-unknown";

export interface ResolvedPrice {
  amountEur: number | null;
  bracketId: string | null;
  bracketLabel: string | null;
  periodId: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  reason: PriceReason;
  nextPeriodStart: string | null;
}

export interface PricedResort {
  id: string;
  name: string;
  region: string;
  passes: string[];
  dayTicketEur: number | null;
}

export interface PlanDays {
  id: string;
  days: number;
}

export interface PriceQuote {
  id: string;
  kind: "pass" | "combo" | "day-tickets";
  passIds: string[];
  passPriceEur: number | null;
  coveredDays: number;
  uncoveredDays: number;
  uncoveredDayTicketEur: number | null;
  totalEur: number | null;
  costPerDayEur: number | null;
  breakEvenDays: number | null;
  priceReason: PriceReason | null;
  nextPeriodStart: string | null;
  coveredResortIds: string[];
  uncoveredResortIds: string[];
}

const EMPTY_PRICE: ResolvedPrice = {
  amountEur: null,
  bracketId: null,
  bracketLabel: null,
  periodId: null,
  periodLabel: null,
  periodStart: null,
  periodEnd: null,
  reason: "no-bracket",
  nextPeriodStart: null,
};

export function yearInBracket(
  year: number,
  bracket: { min_birth_year: number | null; max_birth_year: number | null },
): boolean {
  if (bracket.min_birth_year != null && year < bracket.min_birth_year) return false;
  if (bracket.max_birth_year != null && year > bracket.max_birth_year) return false;
  return true;
}

export function periodCovers(period: Pick<PricePeriod, "start" | "end">, date: string): boolean {
  if (period.start && date < period.start) return false;
  if (period.end && date > period.end) return false;
  return true;
}

export function resolvePrice(pass: Pass, birthYear: number | null, purchaseDate: string): ResolvedPrice {
  if (birthYear == null || !Number.isInteger(birthYear)) {
    return { ...EMPTY_PRICE, reason: "no-birth-year" };
  }
  const bracket = pass.pricing.brackets.find((item) => yearInBracket(birthYear, item));
  if (!bracket) return { ...EMPTY_PRICE, reason: "no-bracket" };

  const period = bracket.periods.find((item) => periodCovers(item, purchaseDate));
  const nextPeriodStart = earliestStartAfter(bracket.periods, purchaseDate);
  if (!period) {
    return {
      ...EMPTY_PRICE,
      bracketId: bracket.id,
      bracketLabel: bracket.label,
      reason: "no-period",
      nextPeriodStart,
    };
  }
  return {
    amountEur: period.price_eur,
    bracketId: bracket.id,
    bracketLabel: bracket.label,
    periodId: period.id,
    periodLabel: period.label,
    periodStart: period.start,
    periodEnd: period.end,
    reason: period.price_eur == null ? "price-unknown" : "ok",
    nextPeriodStart: null,
  };
}

export interface BracketPrice {
  bracketId: string;
  bracketLabel: string;
  amountEur: number | null;
  periodId: string | null;
  periodLabel: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  reason: PriceReason;
  nextPeriodStart: string | null;
}

export function pricesOnDate(pass: Pass, purchaseDate: string): BracketPrice[] {
  return pass.pricing.brackets.map((bracket) => {
    const period = bracket.periods.find((item) => periodCovers(item, purchaseDate));
    if (!period) {
      return {
        bracketId: bracket.id,
        bracketLabel: bracket.label,
        amountEur: null,
        periodId: null,
        periodLabel: null,
        periodStart: null,
        periodEnd: null,
        reason: "no-period",
        nextPeriodStart: earliestStartAfter(bracket.periods, purchaseDate),
      };
    }
    return {
      bracketId: bracket.id,
      bracketLabel: bracket.label,
      amountEur: period.price_eur,
      periodId: period.id,
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      reason: period.price_eur == null ? "price-unknown" : "ok",
      nextPeriodStart: null,
    };
  });
}

export function quotePlan(passes: Pass[], resorts: PricedResort[], birthYear: number | null, purchaseDate: string, plan: PlanDays[]): PriceQuote[] {
  const daysById = new Map<string, number>();
  for (const item of plan) {
    if (item.days > 0) daysById.set(item.id, (daysById.get(item.id) ?? 0) + item.days);
  }
  const active = resorts.filter((resort) => (daysById.get(resort.id) ?? 0) > 0);

  const singles = passes.map((pass) => quoteFor(passes, [pass.id], active, daysById, birthYear, purchaseDate));
  const combos: PriceQuote[] = [];
  for (let i = 0; i < passes.length; i++) {
    for (let j = i + 1; j < passes.length; j++) {
      const a = passes[i].id;
      const b = passes[j].id;
      if (isUsefulCombo(a, b, resorts, active)) {
        combos.push(quoteFor(passes, [a, b], active, daysById, birthYear, purchaseDate));
      }
    }
  }
  return [...singles, ...combos, dayTicketQuote(active, daysById)];
}

export function cheapestFullCoverage(quotes: PriceQuote[]): PriceQuote | null {
  const full = quotes.filter((quote) => quote.uncoveredDays === 0 && quote.totalEur != null && quote.coveredDays > 0);
  full.sort((a, b) => a.totalEur! - b.totalEur! || a.passIds.length - b.passIds.length || a.id.localeCompare(b.id));
  return full[0] ?? null;
}

export function distributeDays(idsInPriorityOrder: string[], days: number): Record<string, number> {
  const result: Record<string, number> = {};
  if (days <= 0) return result;
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of idsInPriorityOrder) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  if (unique.length === 0) return result;
  const base = Math.floor(days / unique.length);
  let remainder = days % unique.length;
  for (const id of unique) {
    const count = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (count > 0) result[id] = count;
  }
  return result;
}

function quoteFor(
  passes: Pass[],
  passIds: string[],
  active: PricedResort[],
  daysById: Map<string, number>,
  birthYear: number | null,
  purchaseDate: string,
): PriceQuote {
  const selected = passIds.map((id) => passes.find((pass) => pass.id === id)).filter((pass): pass is Pass => Boolean(pass));
  const resolved = selected.map((pass) => resolvePrice(pass, birthYear, purchaseDate));
  const passPriceKnown = resolved.every((price) => price.amountEur != null);
  const passPriceEur = passPriceKnown ? resolved.reduce((sum, price) => sum + (price.amountEur ?? 0), 0) : null;
  const failed = resolved.find((price) => price.amountEur == null);

  const covered = active.filter((resort) => passIds.some((id) => resort.passes.includes(id)));
  const uncovered = active.filter((resort) => !passIds.some((id) => resort.passes.includes(id)));
  const coveredDays = sumDays(covered, daysById);
  const uncoveredDays = sumDays(uncovered, daysById);
  const uncoveredDayTicketEur = ticketCost(uncovered, daysById);
  const coveredDayTicketEur = ticketCost(covered, daysById);
  const totalEur = passPriceEur != null && uncoveredDayTicketEur != null ? passPriceEur + uncoveredDayTicketEur : null;
  const plannedDays = coveredDays + uncoveredDays;
  const costPerDayEur = totalEur != null && plannedDays > 0 ? totalEur / plannedDays : null;
  let breakEvenDays: number | null = null;
  if (passPriceEur != null && coveredDayTicketEur != null && coveredDays > 0 && coveredDayTicketEur > 0) {
    breakEvenDays = passPriceEur / (coveredDayTicketEur / coveredDays);
  }

  return {
    id: passIds.length > 1 ? `combo:${passIds.join("+")}` : `pass:${passIds[0]}`,
    kind: passIds.length > 1 ? "combo" : "pass",
    passIds,
    passPriceEur,
    coveredDays,
    uncoveredDays,
    uncoveredDayTicketEur,
    totalEur,
    costPerDayEur,
    breakEvenDays,
    priceReason: failed?.reason ?? null,
    nextPeriodStart: failed?.nextPeriodStart ?? null,
    coveredResortIds: covered.map((resort) => resort.id),
    uncoveredResortIds: uncovered.map((resort) => resort.id),
  };
}

function dayTicketQuote(active: PricedResort[], daysById: Map<string, number>): PriceQuote {
  const coveredDays = sumDays(active, daysById);
  const total = ticketCost(active, daysById);
  return {
    id: "day-tickets",
    kind: "day-tickets",
    passIds: [],
    passPriceEur: 0,
    coveredDays,
    uncoveredDays: 0,
    uncoveredDayTicketEur: 0,
    totalEur: total,
    costPerDayEur: total != null && coveredDays > 0 ? total / coveredDays : null,
    breakEvenDays: null,
    priceReason: total == null && coveredDays > 0 ? "price-unknown" : null,
    nextPeriodStart: null,
    coveredResortIds: active.map((resort) => resort.id),
    uncoveredResortIds: [],
  };
}

function isUsefulCombo(a: string, b: string, resorts: PricedResort[], active: PricedResort[]): boolean {
  if (active.length === 0) return false;
  const onlyA = active.some((resort) => resort.passes.includes(a) && !resort.passes.includes(b));
  const onlyB = active.some((resort) => resort.passes.includes(b) && !resort.passes.includes(a));
  if (!onlyA || !onlyB) return false;
  const setA = new Set(resorts.filter((resort) => resort.passes.includes(a)).map((resort) => resort.id));
  const setB = new Set(resorts.filter((resort) => resort.passes.includes(b)).map((resort) => resort.id));
  let addsA = false;
  let addsB = false;
  for (const id of setA) if (!setB.has(id)) addsA = true;
  for (const id of setB) if (!setA.has(id)) addsB = true;
  return addsA && addsB;
}

function sumDays(list: PricedResort[], daysById: Map<string, number>): number {
  return list.reduce((sum, resort) => sum + (daysById.get(resort.id) ?? 0), 0);
}

function ticketCost(list: PricedResort[], daysById: Map<string, number>): number | null {
  let sum = 0;
  for (const resort of list) {
    const days = daysById.get(resort.id) ?? 0;
    if (days === 0) continue;
    if (resort.dayTicketEur == null) return null;
    sum += days * resort.dayTicketEur;
  }
  return sum;
}

function earliestStartAfter(periods: PricePeriod[], date: string): string | null {
  const starts = periods.map((period) => period.start).filter((start): start is string => Boolean(start && start > date));
  starts.sort();
  return starts[0] ?? null;
}
