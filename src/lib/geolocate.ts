import type { SavedPlace } from "./places";
import { distanceKm } from "./distance";

/** One device location. A new fix replaces the previous one. */
export const GEO_PLACE_ID = "geo:me";

/**
 * How long to wait after the visitor asks. The permission prompt counts toward a
 * getCurrentPosition timeout, so a slow Allow used to fail before any fix arrived.
 */
export const GEO_WAIT_MS = 20_000;

export type GeoFailure = "denied" | "timeout" | "unsupported";

export class GeoLocateError extends Error {
  readonly reason: GeoFailure;
  constructor(reason: GeoFailure) {
    super(reason);
    this.name = "GeoLocateError";
    this.reason = reason;
  }
}

export interface GeoFix {
  lat: number;
  lon: number;
  /** Meters. Null when the browser omits it. */
  accuracy: number | null;
  /** Degrees clockwise from north. Null when the device is still or the browser has no direction. */
  heading: number | null;
}

/** Heading is noise below a slow walk. */
export const HEADING_MIN_SPEED_MPS = 0.5;
/** Persist the one device place after it moves this far, so storage is not a trail of ticks. */
export const STORE_MOVE_M = 40;
export const STORE_EVERY_MS = 8_000;
const ACCURACY_MIN_M = 8;
const ACCURACY_MAX_M = 5_000;

export function parseFix(position: GeolocationPosition): GeoFix | null {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const rawAccuracy = position.coords.accuracy;
  const accuracy = Number.isFinite(rawAccuracy) && rawAccuracy > 0 ? rawAccuracy : null;
  const speed = position.coords.speed;
  const rawHeading = position.coords.heading;
  const moving = Number.isFinite(speed) && (speed as number) >= HEADING_MIN_SPEED_MPS;
  const heading = moving && Number.isFinite(rawHeading) && (rawHeading as number) >= 0 && (rawHeading as number) <= 360 ? (rawHeading as number) : null;
  return { lat, lon, accuracy, heading };
}

/** True for the first fix, a real move, or a slow tick so the saved point does not go stale. */
export function shouldStoreFix(previous: { lat: number; lon: number; at: number } | null, fix: GeoFix, now: number): boolean {
  if (!previous) return true;
  if (now - previous.at >= STORE_EVERY_MS) return true;
  return distanceKm(previous, fix) * 1000 >= STORE_MOVE_M;
}

/** A closed ring around the fix. The radius is the reported accuracy, kept in a sane range. */
export function accuracyCircle(lon: number, lat: number, meters: number, steps = 64): Array<[number, number]> {
  const radius = Math.min(ACCURACY_MAX_M, Math.max(ACCURACY_MIN_M, meters));
  const latRad = (lat * Math.PI) / 180;
  const metersPerLat = 111_320;
  const metersPerLon = Math.max(1, 111_320 * Math.cos(latRad));
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([lon + (radius * Math.sin(angle)) / metersPerLon, lat + (radius * Math.cos(angle)) / metersPerLat]);
  }
  return ring;
}

/** Drop earlier device fixes and keep the new one with the saved cities. */
export function upsertDevicePlace(places: SavedPlace[], place: SavedPlace): SavedPlace[] {
  return [...places.filter((item) => item.kind !== "geo"), place].slice(-12);
}

/** Remove the device fix. Saved cities stay. */
export function dropDevicePlaces(places: SavedPlace[]): SavedPlace[] {
  return places.filter((place) => place.kind !== "geo");
}

/** True for this visit's fix and for older `geo-…` ids still in storage. */
export function isDevicePlaceId(id: string | null): boolean {
  return id === GEO_PLACE_ID || (id != null && id.startsWith("geo-"));
}

export interface GeoPermissionSource {
  query(descriptor: { name: "geolocation" }): Promise<PermissionStatus>;
}

/**
 * Reports the geolocation permission, including later changes.
 * The first call is the current state. A missing or rejected query (some browsers) does nothing.
 */
export function watchGeoPermission(permissions: GeoPermissionSource | undefined, onChange: (state: PermissionState) => void): () => void {
  if (!permissions?.query) return () => {};
  let stopped = false;
  let status: PermissionStatus | null = null;
  const notify = () => {
    if (!stopped && status) onChange(status.state);
  };
  permissions.query({ name: "geolocation" }).then(
    (next) => {
      if (stopped) return;
      status = next;
      next.addEventListener("change", notify);
      notify();
    },
    () => {
      // This browser does not report geolocation permission.
    },
  );
  return () => {
    stopped = true;
    status?.removeEventListener("change", notify);
  };
}

export interface ReadDeviceLocationOptions {
  waitMs?: number;
  /** When this reports `denied`, no fix is read and nothing is returned to save. */
  permissions?: GeoPermissionSource;
}

function permissionState(permissions: GeoPermissionSource | undefined): Promise<PermissionState | null> {
  if (!permissions?.query) return Promise.resolve(null);
  return permissions.query({ name: "geolocation" }).then(
    (status) => status.state,
    () => null,
  );
}

/**
 * Watch until the browser shares a fresh fix, the visitor refuses, or the wait runs out.
 * A timeout or an unavailable reading does not stop the watch: those often fire while the
 * permission prompt is open, and a fix follows the Allow click.
 * The watch always runs, including when permission was already denied, so the browser can ask again.
 * A reading is dropped when permission is still denied, so a cached fix cannot come back.
 */
export function readDeviceLocation(geolocation: Geolocation, options?: ReadDeviceLocationOptions): Promise<GeoFix> {
  const waitMs = options?.waitMs ?? GEO_WAIT_MS;
  return watchFreshFix(geolocation, waitMs, options?.permissions);
}

function watchFreshFix(geolocation: Geolocation, waitMs: number, permissions: GeoPermissionSource | undefined): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let watchId = 0;
    const stop = () => {
      clearTimeout(timer);
      try {
        geolocation.clearWatch(watchId);
      } catch {
        // The watch was already cleared.
      }
    };
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      stop();
      run();
    };
    const timer = setTimeout(() => finish(() => reject(new GeoLocateError("timeout"))), waitMs);
    try {
      watchId = geolocation.watchPosition(
        (position) => {
          const fix = parseFix(position);
          if (!fix) return;
          void permissionState(permissions).then((state) => {
            if (state === "denied") finish(() => reject(new GeoLocateError("denied")));
            else finish(() => resolve(fix));
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) finish(() => reject(new GeoLocateError("denied")));
        },
        { enableHighAccuracy: false, maximumAge: 0, timeout: waitMs },
      );
    } catch {
      finish(() => reject(new GeoLocateError("unsupported")));
    }
  });
}

export interface FollowHandlers {
  onFix: (fix: GeoFix) => void;
  onError: (error: GeoLocateError) => void;
}

/**
 * One open watch. The first fix and every later fix are reported. The caller stops it.
 * A denial stops the watch. The wait only applies until the first fix, so a prompt can finish.
 */
export function followDeviceLocation(
  geolocation: Geolocation,
  options: ReadDeviceLocationOptions | undefined,
  handlers: FollowHandlers,
): () => void {
  const waitMs = options?.waitMs ?? GEO_WAIT_MS;
  const permissions = options?.permissions;
  let stopped = false;
  let sawFix = false;
  let watchId = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    try {
      geolocation.clearWatch(watchId);
    } catch {
      // The watch was already cleared.
    }
  };
  const fail = (error: GeoLocateError) => {
    if (stopped) return;
    stop();
    handlers.onError(error);
  };
  const timer = setTimeout(() => {
    if (!sawFix) fail(new GeoLocateError("timeout"));
  }, waitMs);
  try {
    watchId = geolocation.watchPosition(
      (position) => {
        const fix = parseFix(position);
        if (!fix || stopped) return;
        void permissionState(permissions).then((state) => {
          if (stopped) return;
          if (state === "denied") {
            fail(new GeoLocateError("denied"));
            return;
          }
          sawFix = true;
          handlers.onFix(fix);
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) fail(new GeoLocateError("denied"));
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: waitMs },
    );
  } catch {
    fail(new GeoLocateError("unsupported"));
  }
  return stop;
}
