import { describe, expect, it } from "vitest";
import { MAPBOX_TRIAL_KEY, MAPBOX_TRIAL_VISITS, MAPBOX_VISIT_GAP_MS, mapboxAccess, readMapboxTrial, recordMapboxUse, touchMapboxVisit } from "./map-access";
import { setCodeQuietUntil, setRewardQuietDays } from "./support/storage";

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("Mapbox access", () => {
  it("gives the first three visits the Mapbox map, then the free map", () => {
    const storage = memory();
    let now = Date.UTC(2026, 9, 1, 9);
    for (let visit = 1; visit <= MAPBOX_TRIAL_VISITS; visit++) {
      const access = mapboxAccess(storage, now);
      expect(access).toEqual({ allowed: true, reason: "trial", newVisit: true, visitsLeft: MAPBOX_TRIAL_VISITS - visit });
      recordMapboxUse(storage, now);
      now += DAY;
    }
    expect(mapboxAccess(storage, now)).toEqual({ allowed: false, reason: "used" });
  });

  it("counts page loads within half an hour as one visit", () => {
    const storage = memory();
    const start = Date.UTC(2026, 9, 1, 9);
    recordMapboxUse(storage, start);
    recordMapboxUse(storage, start + 10 * 60 * 1000);
    recordMapboxUse(storage, start + 25 * 60 * 1000);
    expect(readMapboxTrial(storage).visits).toBe(1);
    expect(mapboxAccess(storage, start + 30 * 60 * 1000)).toMatchObject({ allowed: true, newVisit: false });
    recordMapboxUse(storage, start + 25 * 60 * 1000 + MAPBOX_VISIT_GAP_MS);
    expect(readMapboxTrial(storage).visits).toBe(2);
  });

  it("keeps the last free visit going while the map is used", () => {
    const storage = memory();
    const start = Date.UTC(2026, 9, 1, 9);
    for (let visit = 0; visit < MAPBOX_TRIAL_VISITS; visit++) recordMapboxUse(storage, start + visit * DAY);
    const last = start + (MAPBOX_TRIAL_VISITS - 1) * DAY;
    touchMapboxVisit(storage, last + 20 * 60 * 1000);
    touchMapboxVisit(storage, last + 40 * 60 * 1000);
    expect(mapboxAccess(storage, last + 55 * 60 * 1000)).toEqual({ allowed: true, reason: "trial", newVisit: false, visitsLeft: 0 });
    expect(mapboxAccess(storage, last + 3 * HOUR)).toEqual({ allowed: false, reason: "used" });
    expect(readMapboxTrial(storage).visits).toBe(MAPBOX_TRIAL_VISITS);
  });

  it("brings the Mapbox map back while an ad or supporter code period runs, without using free visits", () => {
    const storage = memory();
    const start = Date.UTC(2026, 9, 1, 9);
    for (let visit = 0; visit < MAPBOX_TRIAL_VISITS; visit++) recordMapboxUse(storage, start + visit * DAY);
    const later = start + 10 * DAY;
    expect(mapboxAccess(storage, later).allowed).toBe(false);

    setRewardQuietDays(storage, 2, later);
    expect(mapboxAccess(storage, later + HOUR)).toEqual({ allowed: true, reason: "supporter", until: later + 2 * DAY });
    recordMapboxUse(storage, later + HOUR);
    expect(readMapboxTrial(storage).visits).toBe(MAPBOX_TRIAL_VISITS);
    expect(mapboxAccess(storage, later + 3 * DAY).allowed).toBe(false);

    setCodeQuietUntil(storage, later + 30 * DAY);
    expect(mapboxAccess(storage, later + 20 * DAY)).toMatchObject({ allowed: true, reason: "supporter" });
  });

  it("treats broken or foreign storage as a fresh start", () => {
    const storage = memory();
    storage.setItem(MAPBOX_TRIAL_KEY, "{not json");
    expect(readMapboxTrial(storage)).toEqual({ visits: 0, lastSeen: 0 });
    storage.setItem(MAPBOX_TRIAL_KEY, JSON.stringify({ visits: -4, lastSeen: "soon" }));
    expect(readMapboxTrial(storage)).toEqual({ visits: 0, lastSeen: 0 });
    expect(mapboxAccess(storage, Date.UTC(2026, 9, 1))).toMatchObject({ allowed: true, newVisit: true });
  });

  it("does not open a visit by touching before any visit", () => {
    const storage = memory();
    touchMapboxVisit(storage, Date.UTC(2026, 9, 1));
    expect(storage.getItem(MAPBOX_TRIAL_KEY)).toBeNull();
  });
});
