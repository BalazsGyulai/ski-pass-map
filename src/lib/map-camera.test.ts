import { describe, expect, it, vi } from "vitest";
import { RESORT_MAX_ZOOM, RESORT_POINT_ZOOM, USER_LOCATION_ZOOM, clampMapPadding, fitResortBounds, flyToResort, flyToUser, resortCameraPadding, visibleBounds } from "./map-camera";
import type { VectorMap } from "./vector-map";

function mockMap(width: number, height: number): VectorMap {
  const el = { clientWidth: width, clientHeight: height };
  return { getContainer: () => el } as VectorMap;
}

describe("resortCameraPadding", () => {
  it("keeps the resort above the visible sheet on narrow viewports", () => {
    const peek = resortCameraPadding({ narrow: true, sheetPx: 196, height: 800 });
    expect(peek.bottom).toBe(212);
    const full = resortCameraPadding({ narrow: true, sheetPx: 716, height: 800 });
    expect(full.bottom).toBe(572);
    const unknown = resortCameraPadding({ narrow: true, sheetPx: null, height: 800 });
    expect(unknown.bottom).toBe(416);
  });

  it("keeps modest padding on desktop", () => {
    const pad = resortCameraPadding({ narrow: false, sheetPx: 400, height: 900 });
    expect(pad.left).toBe(32);
    expect(pad.bottom).toBe(48);
  });
});

describe("clampMapPadding", () => {
  it("shrinks padding on short map containers", () => {
    const pad = clampMapPadding(mockMap(320, 200), { top: 88, bottom: 240, left: 24, right: 24 });
    expect(pad.top + pad.bottom).toBeLessThan(200);
  });

  it("keeps a tall sheet's bottom padding so the resort stays above it", () => {
    const pad = clampMapPadding(mockMap(390, 844), { top: 88, bottom: 480, left: 24, right: 24 });
    expect(pad.bottom).toBe(480);
    expect(pad.top).toBe(88);
  });

  it("keeps the whole side panel and caps only the space beside it", () => {
    const pad = clampMapPadding(mockMap(1000, 800), { top: 72, bottom: 48, left: 400, right: 32 }, 412);
    // 32% of the 588 px beside the panel is 188 px.
    expect(pad.left).toBe(412 + 188);
    expect(pad.right).toBe(32);
  });
});

describe("visibleBounds", () => {
  // A flat map 1440 px wide showing 0°–14.4° east: 0.01° per pixel.
  function flatMap(westOfBounds: number): VectorMap {
    const el = { clientWidth: 1440, clientHeight: 800 };
    const bounds = { getSouth: () => 45, getWest: () => westOfBounds, getNorth: () => 49, getEast: () => 14.4 };
    return {
      getContainer: () => el,
      getBounds: () => bounds,
      getBearing: () => 0,
      unproject: ([x]: [number, number]) => ({ lng: x * 0.01, lat: 47 }),
    } as unknown as VectorMap;
  }

  it("drops the part under the panel when the bounds cover the whole canvas (MapLibre)", () => {
    expect(visibleBounds(flatMap(0), 412).west).toBeCloseTo(4.12);
  });

  it("does not drop it twice when the bounds already leave the padding out (Mapbox GL)", () => {
    expect(visibleBounds(flatMap(4.12), 412).west).toBeCloseTo(4.12);
  });

  it("keeps the full bounds without a panel", () => {
    expect(visibleBounds(flatMap(0), 0).west).toBe(0);
  });
});

describe("RESORT_MAX_ZOOM", () => {
  it("lets a resort's runs fill the view up to zoom 15", () => {
    expect(RESORT_MAX_ZOOM).toBe(15);
    expect(RESORT_POINT_ZOOM).toBe(14);
  });
});

describe("flyToResort", () => {
  function camera(zoom: number) {
    const flyTo = vi.fn();
    const map = {
      getContainer: () => ({ clientWidth: 800, clientHeight: 600 }),
      getZoom: () => zoom,
      flyTo,
    } as unknown as VectorMap;
    return { map, flyTo };
  }

  it("comes in to the point zoom and leaves a closer view alone", () => {
    const overview = camera(7);
    const padding = { top: 0, bottom: 0, left: 0, right: 0 };
    flyToResort(overview.map, 15, 47, { duration: 0, padding });
    expect(overview.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [15, 47], zoom: RESORT_POINT_ZOOM }));

    const close = camera(16);
    flyToResort(close.map, 15, 47, { duration: 0, padding });
    expect(close.flyTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 16 }));
  });
});

describe("fitResortBounds", () => {
  it("includes the side panel when the library replaces the map padding", () => {
    const fitBounds = vi.fn();
    const setPadding = vi.fn();
    const map = {
      getContainer: () => ({ clientWidth: 1440, clientHeight: 900 }),
      fitBounds,
      setPadding,
    } as unknown as VectorMap;
    const padding = { top: 72, bottom: 48, left: 32, right: 32 };
    fitResortBounds(map, [[15, 47], [15.2, 47.2]], { duration: 0, padding, panelPx: 440, replacePadding: true });
    expect(fitBounds.mock.calls[0][1].padding.left).toBeGreaterThanOrEqual(440);

    fitBounds.mockClear();
    fitResortBounds(map, [[15, 47], [15.2, 47.2]], { duration: 0, padding, panelPx: 440 });
    expect(setPadding).toHaveBeenCalledWith({ top: 0, right: 0, bottom: 0, left: 440 });
    expect(fitBounds.mock.calls[0][1].padding.left).toBe(32);
  });
});

describe("flyToUser", () => {
  function camera(zoom: number) {
    const flyTo = vi.fn();
    const map = {
      getContainer: () => ({ clientWidth: 800, clientHeight: 600 }),
      getZoom: () => zoom,
      flyTo,
    } as unknown as VectorMap;
    return { map, flyTo };
  }

  it("frames the device from an overview and leaves a closer zoom alone", () => {
    const overview = camera(5);
    flyToUser(overview.map, 16.37, 48.2, { duration: 0, padding: { top: 8, bottom: 8, left: 8, right: 8 } });
    expect(overview.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [16.37, 48.2], zoom: USER_LOCATION_ZOOM }));

    const close = camera(14);
    flyToUser(close.map, 16.37, 48.2, { duration: 0, padding: { top: 8, bottom: 8, left: 8, right: 8 } });
    expect(close.flyTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 14 }));
  });

  it("ignores a fix that is not a coordinate", () => {
    const { map, flyTo } = camera(6);
    flyToUser(map, Number.NaN, 48, { duration: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    expect(flyTo).not.toHaveBeenCalled();
  });
});
