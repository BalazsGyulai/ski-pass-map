import { LOCALE_FORMATS } from "@/i18n/formats";
import type { Lang } from "@/i18n/languages";

export function todayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(today: string, date: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${date}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Digits with the language's separators, rounded half up to `maxFraction` places. Hand-rolled
 * instead of Intl so the pre-rendered page and every browser print the same (see i18n/formats).
 */
function digits(value: number, minFraction: number, maxFraction: number, group: string, decimal: string, minGroup: number): string {
  const scale = 10 ** maxFraction;
  const scaled = Math.round(Math.abs(value) * scale);
  let whole = String(Math.floor(scaled / scale));
  let fraction = maxFraction > 0 ? String(scaled % scale).padStart(maxFraction, "0") : "";
  while (fraction.length > minFraction && fraction.endsWith("0")) fraction = fraction.slice(0, -1);
  if (whole.length > 2 + minGroup) whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return fraction ? `${whole}${decimal}${fraction}` : whole;
}

/** The minus sign in front, unless the amount rounds to zero. */
function signed(lang: Lang, value: number, text: string, places: number): string {
  return value < 0 && Math.round(Math.abs(value) * 10 ** places) > 0 ? `${LOCALE_FORMATS[lang].minus ?? "-"}${text}` : text;
}

export function formatEur(lang: Lang, value: number): string {
  if (!Number.isFinite(value)) return "";
  const spec = LOCALE_FORMATS[lang];
  const places = Math.abs(value - Math.round(value)) > 0.001 ? 2 : 0;
  const amount = digits(value, places, places, spec.euroGroup ?? spec.group, spec.decimal, spec.minGroup ?? 1);
  return signed(lang, value, spec.euro.replace("#", amount), places);
}

/** A calendar date (YYYY-MM-DD, day or month optional) with a short month, as each language writes it. */
export function formatDate(lang: Lang, iso: string): string {
  const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(iso);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2] ?? 1) - 1, Number(match[3] ?? 1)));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const spec = LOCALE_FORMATS[lang];
  return spec.date.replace(/\{(dd|d|MMM|MM|M|y)\}/g, (_, token: string) => {
    if (token === "dd") return String(day).padStart(2, "0");
    if (token === "d") return String(day);
    if (token === "MMM") return spec.months?.[month - 1] ?? String(month);
    if (token === "MM") return String(month).padStart(2, "0");
    if (token === "M") return String(month);
    return String(year);
  });
}

export function formatNumber(lang: Lang, value: number, options: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {}): string {
  if (!Number.isFinite(value)) return "";
  const spec = LOCALE_FORMATS[lang];
  const min = options.minimumFractionDigits ?? 0;
  const max = Math.max(min, options.maximumFractionDigits ?? 3);
  return signed(lang, value, digits(value, min, max, spec.group, spec.decimal, spec.minGroup ?? 1), max);
}

export function formatKm(lang: Lang, km: number): string {
  if (!Number.isFinite(km)) return "";
  if (km < 10) return formatNumber(lang, km, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return formatNumber(lang, Math.round(km), { maximumFractionDigits: 0 });
}

export function formatBreakEven(days: number): string {
  if (!Number.isFinite(days)) return "";
  return (Math.round(days * 10) / 10).toString();
}

export function finiteOrBlank(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

/** Slopes: hide 0 and missing values (0 km in data usually means unknown). */
export function slopeKmDisplay(value: number | null | undefined): number | null {
  const n = finiteOrBlank(value);
  if (n == null || n <= 0) return null;
  return n;
}
