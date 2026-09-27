import type { FieldChange } from "@/lib/admin/edits";

export const MAX_FIELDS_PER_RESORT_PER_DAY = 10;
export const COUNT_DELTA_RATIO = 0.3;
export const DATE_DELTA_DAYS = 60;

export function utcDayKey(nowMs = Date.now()): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function countChangeExceedsLimit(before: unknown, after: unknown): boolean {
  const b = typeof before === "number" ? before : Number(before);
  const a = typeof after === "number" ? after : Number(after);
  if (!Number.isFinite(b) || !Number.isFinite(a) || b === 0) return false;
  const ratio = Math.abs(a - b) / Math.abs(b);
  return ratio > COUNT_DELTA_RATIO;
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dateChangeExceedsLimit(before: unknown, after: unknown): boolean {
  const b = parseIsoDate(before);
  const a = parseIsoDate(after);
  if (!b || !a) return false;
  const ms = Math.abs(a.getTime() - b.getTime());
  return ms > DATE_DELTA_DAYS * 24 * 60 * 60 * 1000;
}

export interface LimitVerdict {
  withinLimits: boolean;
  reasons: string[];
}

export function evaluateChangeLimits(changes: FieldChange[]): LimitVerdict {
  const reasons: string[] = [];
  for (const c of changes) {
    if (c.kind === "number" || c.kind === "lift" || /lift|slope|count/i.test(c.path)) {
      if (countChangeExceedsLimit(c.before, c.after)) reasons.push(`count_limit:${c.path}`);
    }
    if (c.kind === "date" || /season|date|open|close/i.test(c.path)) {
      if (dateChangeExceedsLimit(c.before, c.after)) reasons.push(`date_limit:${c.path}`);
    }
  }
  return { withinLimits: reasons.length === 0, reasons };
}

export function wouldExceedDailyFieldCap(currentCount: number, newFields: number): boolean {
  return currentCount + newFields > MAX_FIELDS_PER_RESORT_PER_DAY;
}
