import { readBannerChoice, shouldShowCookieBanner } from "./banner";

/** True while the first-visit cookie banner has not been answered (settings panel open counts as pending). */
export function isConsentPending(storage: Storage = typeof window !== "undefined" ? window.localStorage : (null as unknown as Storage)): boolean {
  if (!storage) return true;
  return shouldShowCookieBanner(storage);
}

export function hasConsentAnswer(storage: Storage): boolean {
  return readBannerChoice(storage) !== null;
}
