import type { Lang } from "./url-state";

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
  return new Intl.NumberFormat(lang === "hu" ? "hu-HU" : "en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(lang: Lang, iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "hu" ? "hu-HU" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)));
}

export function formatKm(km: number): string {
  if (km < 10) return km.toFixed(1);
  return Math.round(km).toString();
}

export function formatBreakEven(days: number): string {
  return (Math.round(days * 10) / 10).toString();
}
