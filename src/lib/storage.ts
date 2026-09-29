import type { SavedPlace } from "./places";
import type { Lang } from "@/i18n/languages";

const KEY = "ski-pass-map-v1";

export type DistanceUnits = "km" | "mi";

export interface StoredPrefs {
  version?: number;
  theme?: "system" | "light" | "dark";
  favourites?: string[];
  birthYear?: number | null;
  purchaseDate?: string | null;
  resortDays?: Record<string, number>;
  lang?: Lang;
  distanceUnits?: DistanceUnits;
  pisteOverlayDefault?: boolean;
  /** 3D terrain and a tilted camera on resorts. On unless turned off. */
  terrain3d?: boolean;
  /**
   * Cars moving along the lifts, saved only once the visitor chooses (from version 5). Without a
   * choice they run unless the system asks for reduced motion.
   */
  liftMotion?: boolean;
  /** The list follows the map as it moves. Off until the visitor turns it on. */
  searchAsMove?: boolean;
  /** Reference places. Never copied into the URL. */
  places?: SavedPlace[];
  activePlaceId?: string | null;
}

export interface ExportedUserData {
  version: 1;
  exportedAt: string;
  favourites: string[];
  resortDays: Record<string, number>;
  places: SavedPlace[];
  activePlaceId: string | null;
  birthYear: number | null;
  purchaseDate: string | null;
  theme: StoredPrefs["theme"];
  distanceUnits: DistanceUnits;
  pisteOverlayDefault: boolean;
  terrain3d?: boolean;
  liftMotion?: boolean;
  /** The list follows the map as it moves. Off until the visitor turns it on. */
  searchAsMove?: boolean;
}

/** Version 5 saves moving lifts only once the visitor chooses. */
export const STORAGE_VERSION = 5;

/** The visitor's own moving-lifts choice. Earlier versions saved the default "on" as if chosen, so there only "off" counts. */
export function storedLiftMotionChoice(stored: Pick<StoredPrefs, "liftMotion" | "version">): boolean | null {
  if (typeof stored.liftMotion !== "boolean") return null;
  if ((stored.version ?? 0) >= STORAGE_VERSION) return stored.liftMotion;
  return stored.liftMotion ? null : false;
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
