import { MAP_CONSENT_STORAGE_KEY } from "@/lib/map-consent";

export const COOKIE_BANNER_KEY = "skimap-cookie-banner";

export const NECESSARY_STORAGE_KEYS = [
  "ski-pass-map-v1",
  "skimap-lang",
  MAP_CONSENT_STORAGE_KEY,
  "skimap-support-first-visit",
  "skimap-support-daily",
  "skimap-support-reward-until",
  "skimap-support-code-until",
  COOKIE_BANNER_KEY,
] as const;

export type CookieBannerChoice = "accepted" | "rejected" | null;

export function readBannerChoice(storage: Storage): CookieBannerChoice {
  const v = storage.getItem(COOKIE_BANNER_KEY);
  if (v === "accepted" || v === "rejected") return v;
  return null;
}

export function writeBannerChoice(storage: Storage, choice: Exclude<CookieBannerChoice, null>): void {
  storage.setItem(COOKIE_BANNER_KEY, choice);
}

export function shouldShowCookieBanner(storage: Storage): boolean {
  return readBannerChoice(storage) === null;
}
