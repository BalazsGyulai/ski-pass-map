import { describe, expect, it } from "vitest";
import { RESORT_MAX_ZOOM, clampMapPadding, resortCameraPadding } from "./map-camera";
import type { VectorMap } from "./vector-map";

function mockMap(width: number, height: number): VectorMap {
  const el = { clientWidth: width, clientHeight: height };
  return { getContainer: () => el } as VectorMap;
}

describe("resortCameraPadding", () => {
  it("uses sheet bottom inset on narrow viewports", () => {
    const peek = resortCameraPadding({ narrow: true, sheet: "peek", height: 800 });
    expect(peek.bottom).toBe(200);
    const half = resortCameraPadding({ narrow: true, sheet: "half", height: 800 });
    expect(half.bottom).toBe(440);
  });

  it("keeps modest padding on desktop", () => {
    const pad = resortCameraPadding({ narrow: false, sheet: "half", height: 900 });
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
