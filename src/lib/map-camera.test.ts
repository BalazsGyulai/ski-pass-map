import { describe, expect, it } from "vitest";
import { RESORT_MAX_ZOOM, clampMapPadding, resortCameraPadding } from "./map-camera";
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
});

describe("RESORT_MAX_ZOOM", () => {
  it("caps resort fly-to zoom for sandbox tile reach", () => {
    expect(RESORT_MAX_ZOOM).toBe(13);
  });
});
