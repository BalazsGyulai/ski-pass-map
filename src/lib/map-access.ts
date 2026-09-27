import { readQuietUntil } from "./support/storage";

/**
 * Who gets the Mapbox map (it costs money per load; OpenFreeMap does not):
 * - everyone for their first few visits, so they see it,
 * - supporters while their ad or Ko-fi period runs.
 * Consent, a token and the monthly budget are still checked on top of this (see map-provider).
 */
export const MAPBOX_TRIAL_VISITS = 3;
/** A visit ends after this long without using the map, the usual analytics session gap. */
export const MAPBOX_VISIT_GAP_MS = 30 * 60 * 1000;
export const MAPBOX_TRIAL_KEY = "skimap-mapbox-trial";

export interface MapboxTrial {
  /** Visits that showed the Mapbox map. */
  visits: number;
  /** Last time the Mapbox map was in use, in ms. */
  lastSeen: number;
}

export type MapboxAccess =
  | { allowed: true; reason: "supporter"; until: number }
  | { allowed: true; reason: "trial"; newVisit: boolean; visitsLeft: number }
  | { allowed: false; reason: "used" };

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "getItem" | "setItem">;

export function readMapboxTrial(storage: ReadStorage): MapboxTrial {
  try {
    const parsed = JSON.parse(storage.getItem(MAPBOX_TRIAL_KEY) ?? "null") as Partial<MapboxTrial> | null;
    const visits = Number(parsed?.visits);
    const lastSeen = Number(parsed?.lastSeen);
    return {
      visits: Number.isFinite(visits) && visits > 0 ? Math.floor(visits) : 0,
      lastSeen: Number.isFinite(lastSeen) && lastSeen > 0 ? lastSeen : 0,
    };
  } catch {
    return { visits: 0, lastSeen: 0 };
  }
}

function sameVisit(trial: MapboxTrial, now: number): boolean {
  return trial.visits > 0 && now >= trial.lastSeen && now - trial.lastSeen < MAPBOX_VISIT_GAP_MS;
}

/** Whether this visitor may get the Mapbox map now. `visitsLeft` counts the visits after this one. */
export function mapboxAccess(storage: ReadStorage, now = Date.now()): MapboxAccess {
  const until = readQuietUntil(storage as Storage);
  if (until > now) return { allowed: true, reason: "supporter", until };
  const trial = readMapboxTrial(storage);
  if (sameVisit(trial, now)) return { allowed: true, reason: "trial", newVisit: false, visitsLeft: Math.max(0, MAPBOX_TRIAL_VISITS - trial.visits) };
  if (trial.visits < MAPBOX_TRIAL_VISITS) return { allowed: true, reason: "trial", newVisit: true, visitsLeft: MAPBOX_TRIAL_VISITS - trial.visits - 1 };
  return { allowed: false, reason: "used" };
}

/**
 * Call once the Mapbox map has shown. A new visit uses up one free visit; supporters use none.
 * Calling it again during the same visit only keeps the visit going.
 */
export function recordMapboxUse(storage: WriteStorage, now = Date.now()): void {
  if (readQuietUntil(storage as Storage) > now) return;
  const trial = readMapboxTrial(storage);
  const visits = sameVisit(trial, now) ? trial.visits : trial.visits + 1;
  storage.setItem(MAPBOX_TRIAL_KEY, JSON.stringify({ visits, lastSeen: now }));
}

/** While the Mapbox map is in use, keep the current visit open without counting a new one. */
export function touchMapboxVisit(storage: WriteStorage, now = Date.now()): void {
  const trial = readMapboxTrial(storage);
  if (trial.visits === 0) return;
  storage.setItem(MAPBOX_TRIAL_KEY, JSON.stringify({ visits: trial.visits, lastSeen: now }));
}
