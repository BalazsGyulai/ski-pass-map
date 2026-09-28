import { afterEach, describe, expect, it, vi } from "vitest";
import { GEO_PLACE_ID, GeoLocateError, accuracyCircle, dropDevicePlaces, followDeviceLocation, isDevicePlaceId, parseFix, readDeviceLocation, shouldStoreFix, upsertDevicePlace, watchGeoPermission, type GeoPermissionSource } from "./geolocate";
import { sanitizeActivePlaceId, sanitizePlaces, type SavedPlace } from "./places";

function position(lat: number, lon: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lon } } as GeolocationPosition;
}

function error(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError;
}

function geo(watch: (success: PositionCallback, error: PositionErrorCallback) => void): Geolocation {
  return {
    watchPosition(success, fail) {
      watch(success, fail!);
      return 7;
    },
    clearWatch() {},
    getCurrentPosition() {},
  };
}

describe("upsertDevicePlace", () => {
  it("replaces an older device fix and keeps saved cities", () => {
    const city: SavedPlace = { id: "city:graz", label: "Graz", lat: 47.07, lon: 15.44, kind: "city" };
    const older: SavedPlace = { id: "geo-old", label: "My location", lat: 1, lon: 2, kind: "geo" };
    const next: SavedPlace = { id: GEO_PLACE_ID, label: "My location", lat: 48.2, lon: 16.37, kind: "geo" };
    const saved = upsertDevicePlace([city, older], next);
    expect(saved).toEqual([city, next]);
    expect(sanitizePlaces(saved)).toEqual([city, next]);
    expect(sanitizeActivePlaceId(GEO_PLACE_ID, saved)).toBe(GEO_PLACE_ID);
  });
});

describe("dropDevicePlaces", () => {
  it("removes the device fix and keeps a saved city", () => {
    const city: SavedPlace = { id: "city:graz", label: "Graz", lat: 47.07, lon: 15.44, kind: "city" };
    const device: SavedPlace = { id: GEO_PLACE_ID, label: "My location", lat: 48.2, lon: 16.37, kind: "geo" };
    expect(dropDevicePlaces([city, device])).toEqual([city]);
    expect(isDevicePlaceId(GEO_PLACE_ID)).toBe(true);
    expect(isDevicePlaceId("geo-old")).toBe(true);
    expect(isDevicePlaceId(city.id)).toBe(false);
    expect(isDevicePlaceId(null)).toBe(false);
  });
});

describe("watchGeoPermission", () => {
  it("reports a later block and stops after unsubscribe", async () => {
    let state: PermissionState = "granted";
    const status = new EventTarget() as PermissionStatus;
    Object.defineProperty(status, "state", { get: () => state });
    const states: PermissionState[] = [];
    const stop = watchGeoPermission(
      { query: () => Promise.resolve(status) },
      (next) => states.push(next),
    );
    await Promise.resolve();
    expect(states).toEqual(["granted"]);
    state = "denied";
    status.dispatchEvent(new Event("change"));
    expect(states).toEqual(["granted", "denied"]);
    stop();
    state = "prompt";
    status.dispatchEvent(new Event("change"));
    expect(states).toEqual(["granted", "denied"]);
  });

  it("ignores a browser that cannot report the permission", async () => {
    const states: PermissionState[] = [];
    watchGeoPermission({ query: () => Promise.reject(new Error("unsupported")) }, (state) => states.push(state));
    await Promise.resolve();
    expect(states).toEqual([]);
  });
});

function permissions(read: () => PermissionState): GeoPermissionSource {
  return {
    query: () => {
      const status = new EventTarget() as PermissionStatus;
      const state = read();
      Object.defineProperty(status, "state", { get: () => state });
      return Promise.resolve(status);
    },
  };
}

describe("readDeviceLocation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when a fix arrives after an unavailable reading", async () => {
    const fix = readDeviceLocation(
      geo((success, fail) => {
        fail(error(2));
        success(position(48.208, 16.373));
      }),
      { waitMs: 5_000 },
    );
    await expect(fix).resolves.toEqual({ lat: 48.208, lon: 16.373, accuracy: null, heading: null });
  });

  it("rejects when the visitor refuses", async () => {
    const fix = readDeviceLocation(
      geo((_success, fail) => {
        fail(error(1));
      }),
      { waitMs: 5_000 },
    );
    await expect(fix).rejects.toMatchObject({ reason: "denied" });
    await expect(fix).rejects.toBeInstanceOf(GeoLocateError);
  });

  it("rejects when the wait runs out with no fix", async () => {
    vi.useFakeTimers();
    const fix = readDeviceLocation(
      geo(() => {
        // The prompt is still open.
      }),
      { waitMs: 1_000 },
    );
    const rejected = expect(fix).rejects.toMatchObject({ reason: "timeout" });
    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;
  });

  it("rejects when the browser has no watch", async () => {
    const broken = {
      watchPosition() {
        throw new Error("insecure");
      },
      clearWatch() {},
      getCurrentPosition() {},
    } as Geolocation;
    await expect(readDeviceLocation(broken, { waitMs: 1_000 })).rejects.toMatchObject({ reason: "unsupported" });
  });

  it("asks again when permission is already denied", async () => {
    const watch = vi.fn((_success: PositionCallback, fail?: PositionErrorCallback | null) => {
      fail?.(error(1));
      return 1;
    });
    const blocked = {
      watchPosition: watch,
      clearWatch() {},
      getCurrentPosition() {},
    } as Geolocation;
    await expect(readDeviceLocation(blocked, { permissions: permissions(() => "denied") })).rejects.toMatchObject({ reason: "denied" });
    expect(watch).toHaveBeenCalled();
  });

  it("asks for a fresh fix when permission is granted", async () => {
    let options: PositionOptions | undefined;
    const allowed = {
      watchPosition(success: PositionCallback, _fail: PositionErrorCallback | null, next?: PositionOptions) {
        options = next;
        success(position(47.26, 11.4));
        return 4;
      },
      clearWatch() {},
      getCurrentPosition() {},
    } as Geolocation;
    await expect(readDeviceLocation(allowed, { permissions: permissions(() => "granted") })).resolves.toEqual({ lat: 47.26, lon: 11.4, accuracy: null, heading: null });
    expect(options?.maximumAge).toBe(0);
  });

  it("rejects a cached fix when permission is denied by the time it arrives", async () => {
    let state: PermissionState = "granted";
    const cached = {
      watchPosition(success: PositionCallback) {
        state = "denied";
        success(position(48.2, 16.37));
        return 4;
      },
      clearWatch() {},
      getCurrentPosition() {},
    } as Geolocation;
    await expect(readDeviceLocation(cached, { permissions: permissions(() => state) })).rejects.toMatchObject({ reason: "denied" });
  });
});

describe("parseFix", () => {
  it("keeps a heading only while the device is moving", () => {
    const still = { coords: { latitude: 47, longitude: 11, accuracy: 12, speed: 0, heading: 90 } } as GeolocationPosition;
    const moving = { coords: { latitude: 47, longitude: 11, accuracy: 12, speed: 2, heading: 90 } } as GeolocationPosition;
    expect(parseFix(still)?.heading).toBeNull();
    expect(parseFix(moving)).toMatchObject({ accuracy: 12, heading: 90 });
  });
});

describe("shouldStoreFix", () => {
  const fix = { lat: 47, lon: 11, accuracy: null, heading: null };
  it("stores the first fix, a later move, and a slow tick, and skips a tiny one", () => {
    expect(shouldStoreFix(null, fix, 1_000)).toBe(true);
    expect(shouldStoreFix({ lat: 47, lon: 11, at: 0 }, fix, 1_000)).toBe(false);
    expect(shouldStoreFix({ lat: 47, lon: 11, at: 0 }, fix, 8_000)).toBe(true);
    expect(shouldStoreFix({ lat: 47, lon: 11, at: 0 }, { ...fix, lat: 47.001 }, 1_000)).toBe(true);
  });
});

describe("accuracyCircle", () => {
  it("rings the fix at about the reported accuracy", () => {
    const ring = accuracyCircle(11, 47, 100, 8);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const north = ring[0];
    const km = Math.abs(north[1] - 47) * 111.32;
    expect(km).toBeGreaterThan(0.09);
    expect(km).toBeLessThan(0.11);
  });
});

describe("followDeviceLocation", () => {
  it("reports later fixes and stops when asked", () => {
    let success: PositionCallback = () => {};
    const fixes: number[] = [];
    const stop = followDeviceLocation(
      {
        watchPosition(next) {
          success = next;
          return 3;
        },
        clearWatch() {},
        getCurrentPosition() {},
      },
      { waitMs: 5_000 },
      {
        onFix(fix) {
          fixes.push(fix.lat);
        },
        onError() {
          fixes.push(-1);
        },
      },
    );
    success(position(47, 11));
    success(position(47.1, 11));
    return Promise.resolve().then(() => {
      expect(fixes).toEqual([47, 47.1]);
      stop();
      success(position(48, 11));
      return Promise.resolve().then(() => {
        expect(fixes).toEqual([47, 47.1]);
      });
    });
  });
});
