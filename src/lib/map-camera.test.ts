import { describe, expect, it } from "vitest";
import { RESORT_MAX_ZOOM, clampMapPadding, resortCameraPadding, visibleBounds } from "./map-camera";
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
    expect(full.bottom).toBe(400);
    const unknown = resortCameraPadding({ narrow: true, sheetPx: null, height: 800 });
    expect(unknown.bottom).toBe(400);
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
  it("caps resort fly-to zoom for sandbox tile reach", () => {
    expect(RESORT_MAX_ZOOM).toBe(13);
  });
});
