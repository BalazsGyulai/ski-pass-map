import type { Lang } from "./url-state";

const KEY = "ski-pass-map-v1";

export interface StoredPrefs {
  theme?: "system" | "light" | "dark";
  favourites?: string[];
  birthYear?: number | null;
  purchaseDate?: string | null;
  resortDays?: Record<string, number>;
  home?: string;
  geoLat?: number | null;
  geoLon?: number | null;
  lang?: Lang;
}

export function readStorage(): StoredPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPrefs;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStorage(prefs: StoredPrefs) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private mode and full storage can reject writes. The page still works.
  }
}
