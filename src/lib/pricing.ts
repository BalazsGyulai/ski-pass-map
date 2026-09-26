import { fold } from "./filter";
import type { AgeBracket, Pass, PricePeriod } from "./schema";

export type PriceReason = "ok" | "no-birth-year" | "no-bracket" | "no-period" | "price-unknown" | "age-not-birth-year";

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
  dayTicketEstimate: boolean;
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
  usesEstimate: boolean;
  breakEvenEstimate: boolean;
}

export interface Deadline {
  id: string;
  date: string;
  kind: "starts" | "ends";
  label: string;
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

export function yearInBracket(year: number, bracket: Pick<AgeBracket, "birth_year_from" | "birth_year_to">): boolean {
  if (bracket.birth_year_from != null && year < bracket.birth_year_from) return false;
  if (bracket.birth_year_to != null && year > bracket.birth_year_to) return false;
  return true;
}

export function isOpenBracket(bracket: Pick<AgeBracket, "birth_year_from" | "birth_year_to">): boolean {
  return bracket.birth_year_from == null && bracket.birth_year_to == null;
}

/** The one adult tariff, matched only by an adult/Erwachsene/Erw. label. Anything else is not guessed. */
export function adultBracket(pass: Pass): AgeBracket | null {
  const matches = pass.pricing.brackets.filter((bracket) => isAdultLabel(bracket.label));
  return matches.length === 1 ? matches[0] : null;
}

function isAdultLabel(label: string): boolean {
  const text = fold(label).replaceAll("ß", "ss");
  if (text.includes("senior")) return false;
  return /^(?:erwachsen(?:e|en|er|es)?|adult|erw)\b/.test(text);
}

/** The note is the only place Snow Card records that the presale has not started yet. */
export function presaleStart(pass: Pass): string | null {
  const match = pass.price_note.match(/[Pp]resale from (\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function resolvePrice(pass: Pass, birthYear: number | null, purchaseDate: string): ResolvedPrice {
  if (birthYear == null || !Number.isInteger(birthYear)) {
    return { ...EMPTY_PRICE, reason: "no-birth-year" };
  }
  const open = pass.pricing.brackets.filter((bracket) => isOpenBracket(bracket));
  const bounded = pass.pricing.brackets.filter((bracket) => !isOpenBracket(bracket));
  const matched = bounded.filter((bracket) => yearInBracket(birthYear, bracket));
  if (matched.length > 1) return { ...EMPTY_PRICE, reason: "no-bracket" };

  const specific = matched[0];
  if (specific) {
    const period = periodOnDate(pass, specific, purchaseDate);
    if (period) return priceFrom(specific, period);
    const fallback = open
      .map((bracket) => ({ bracket, period: periodOnDate(pass, bracket, purchaseDate) }))
      .find((item) => item.period);
    if (fallback?.period) return priceFrom(fallback.bracket, fallback.period);
    return {
      ...EMPTY_PRICE,
      bracketId: specific.label,
      bracketLabel: specific.label,
      reason: "no-period",
      nextPeriodStart: nextStart(pass, specific, purchaseDate),
    };
  }

  if (bounded.length === 0 && open.length === 1) {
    const bracket = open[0];
    const period = periodOnDate(pass, bracket, purchaseDate);
    if (!period) {
      return {
        ...EMPTY_PRICE,
        bracketId: bracket.label,
        bracketLabel: bracket.label,
        reason: "no-period",
        nextPeriodStart: nextStart(pass, bracket, purchaseDate),
      };
    }
    return priceFrom(bracket, period);
  }
  if (bounded.length === 0 && open.length > 1) {
    return { ...EMPTY_PRICE, reason: "age-not-birth-year" };
  }
  return { ...EMPTY_PRICE, reason: "no-bracket" };
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
    const period = periodOnDate(pass, bracket, purchaseDate);
    if (!period) {
      return {
        bracketId: bracket.label,
        bracketLabel: bracket.label,
        amountEur: null,
        periodId: null,
        periodLabel: null,
        periodStart: null,
        periodEnd: null,
        reason: "no-period" as const,
        nextPeriodStart: nextStart(pass, bracket, purchaseDate),
      };
    }
    const resolved = priceFrom(bracket, period);
    return {
      bracketId: bracket.label,
      bracketLabel: bracket.label,
      amountEur: resolved.amountEur,
      periodId: resolved.periodId,
      periodLabel: resolved.periodLabel,
      periodStart: resolved.periodStart,
      periodEnd: resolved.periodEnd,
      reason: resolved.reason,
      nextPeriodStart: null,
    };
  });
}

export function deadlinesFor(pass: Pass): Deadline[] {
  const events: Deadline[] = [];
  const start = presaleStart(pass);
  if (start) {
    events.push({ id: `${pass.id}-presale`, date: start, kind: "starts", label: "Presale starts" });
  }
  const byDate = new Map<string, string[]>();
  for (const bracket of pass.pricing.brackets) {
    const periods = periodsFor(pass, bracket.label);
    for (let index = 0; index < periods.length; index++) {
      const period = periods[index];
      if (!period.valid_until || period.price_eur == null) continue;
      const next = periods[index + 1];
      const change =
        next && next.price_eur != null
          ? `${bracket.label} €${period.price_eur} → €${next.price_eur}`
          : `${bracket.label} €${period.price_eur} ends`;
      const list = byDate.get(period.valid_until) ?? [];
      list.push(change);
      byDate.set(period.valid_until, list);
    }
    const opens = openBracketStart(pass, bracket);
    if (opens) {
      const price = periods[0]?.price_eur;
      events.push({
        id: `${pass.id}-open-${opens}`,
        date: opens,
        kind: "starts",
        label: price == null ? bracket.label : `${bracket.label} €${price}`,
      });
    }
  }
  for (const [date, changes] of byDate) {
    events.push({ id: `${pass.id}-${date}`, date, kind: "ends", label: changes.join("; ") });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  return events;
}

/**
 * Adult price when no birth year is set. A birth year uses that pass's own bracket
 * and does not fall back to another age group.
 */
export function resolveForViewer(pass: Pass, birthYear: number | null, purchaseDate: string): ResolvedPrice {
  if (birthYear != null && Number.isInteger(birthYear)) return resolvePrice(pass, birthYear, purchaseDate);
  const bracket = adultBracket(pass);
  if (!bracket) return { ...EMPTY_PRICE, reason: "no-bracket" };
  const period = periodOnDate(pass, bracket, purchaseDate);
  if (!period) {
    return {
      ...EMPTY_PRICE,
      bracketId: bracket.label,
      bracketLabel: bracket.label,
      reason: "no-period",
      nextPeriodStart: nextStart(pass, bracket, purchaseDate),
    };
  }
  return priceFrom(bracket, period);
}

export interface PriceChange {
  date: string;
  fromEur: number;
  toEur: number;
  bracketLabel: string;
}

/** The next published cut-off for the tariff the viewer is on, when the price actually changes. */
export function nextPriceChange(pass: Pass, birthYear: number | null, purchaseDate: string): PriceChange | null {
  const price = resolveForViewer(pass, birthYear, purchaseDate);
  if (price.amountEur == null || !price.bracketLabel || !price.periodEnd) return null;
  const periods = periodsFor(pass, price.bracketLabel);
  const index = periods.findIndex((period) => period.valid_until === price.periodEnd);
  const next = index >= 0 ? periods[index + 1] : undefined;
  if (!next || next.price_eur == null || next.price_eur === price.amountEur) return null;
  return {
    date: price.periodEnd,
    fromEur: price.amountEur,
    toEur: next.price_eur,
    bracketLabel: price.bracketLabel,
  };
}

/** How much an option saves against paying day tickets for the same days. Negative when the option costs more. */
export function savingsVsDayTickets(option: PriceQuote, dayTickets: PriceQuote): number | null {
  if (option.totalEur == null || dayTickets.totalEur == null) return null;
  return dayTickets.totalEur - option.totalEur;
}

export function quotePlan(
  passes: Pass[],
  resorts: PricedResort[],
  birthYear: number | null,
  purchaseDate: string,
  plan: PlanDays[],
): PriceQuote[] {
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
      if (isUsefulCombo(a, b, active)) {
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

/** 2026/27 is the launch season. Any other labelled season is an estimate for that winter. */
export function dayTicketIsEstimate(season: string | null, amount: number | null): boolean {
  return amount != null && season !== "2026/27";
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
  const resolved = selected.map((pass) => resolveForViewer(pass, birthYear, purchaseDate));
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
  const usesEstimate = uncoveredDayTicketEur != null && uncoveredDayTicketEur > 0 && anyEstimate(uncovered, daysById);
  const breakEvenEstimate = breakEvenDays != null && anyEstimate(covered, daysById);

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
    usesEstimate,
    breakEvenEstimate,
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
    usesEstimate: anyEstimate(active, daysById),
    breakEvenEstimate: false,
  };
}

function isUsefulCombo(a: string, b: string, active: PricedResort[]): boolean {
  const onlyA = active.some((resort) => resort.passes.includes(a) && !resort.passes.includes(b));
  const onlyB = active.some((resort) => resort.passes.includes(b) && !resort.passes.includes(a));
  return onlyA && onlyB;
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

function anyEstimate(list: PricedResort[], daysById: Map<string, number>): boolean {
  return list.some((resort) => (daysById.get(resort.id) ?? 0) > 0 && resort.dayTicketEstimate);
}

function periodsFor(pass: Pass, label: string): PricePeriod[] {
  return pass.pricing.periods
    .filter((period) => period.bracket === label)
    .sort((a, b) => {
      if (a.valid_until == null) return 1;
      if (b.valid_until == null) return -1;
      return a.valid_until.localeCompare(b.valid_until);
    });
}

function periodOnDate(pass: Pass, bracket: AgeBracket, date: string): PricePeriod | null {
  const presale = presaleStart(pass);
  if (presale && date < presale) return null;
  const opens = openBracketStart(pass, bracket);
  if (opens && date < opens) return null;
  for (const period of periodsFor(pass, bracket.label)) {
    if (period.valid_until == null || date <= period.valid_until) return period;
  }
  return null;
}

function openBracketStart(pass: Pass, bracket: AgeBracket): string | null {
  if (!isOpenBracket(bracket)) return null;
  const ownDated = periodsFor(pass, bracket.label).some((period) => period.valid_until != null);
  if (ownDated) return null;
  const latest = pass.pricing.periods
    .map((period) => period.valid_until)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  return latest ? addDays(latest, 1) : null;
}

function nextStart(pass: Pass, bracket: AgeBracket, date: string): string | null {
  const presale = presaleStart(pass);
  if (presale && date < presale) return presale;
  const opens = openBracketStart(pass, bracket);
  if (opens && date < opens) return opens;
  const next = periodsFor(pass, bracket.label)
    .map((period) => period.valid_until)
    .filter((end): end is string => Boolean(end && end >= date))
    .sort()[0];
  return next ? addDays(next, 1) : null;
}

function priceFrom(bracket: AgeBracket, period: PricePeriod): ResolvedPrice {
  return {
    amountEur: period.price_eur,
    bracketId: bracket.label,
    bracketLabel: bracket.label,
    periodId: `${bracket.label}:${period.valid_until ?? "open"}`,
    periodLabel: period.valid_until ? `until ${period.valid_until}` : "after the last cut-off",
    periodStart: null,
    periodEnd: period.valid_until,
    reason: period.price_eur == null ? "price-unknown" : "ok",
    nextPeriodStart: null,
  };
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
