import type { Lang } from "@/i18n/languages";
import { intlLocale } from "@/i18n/languages";

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

export function formatEur(lang: Lang, value: number): string {
  if (!Number.isFinite(value)) return "";
  const cents = Math.abs(value - Math.round(value)) > 0.001;
  return new Intl.NumberFormat(intlLocale(lang), {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(value);
}

export function formatDate(lang: Lang, iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(intlLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)));
}

export function formatNumber(lang: Lang, value: number, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat(intlLocale(lang), options).format(value);
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
