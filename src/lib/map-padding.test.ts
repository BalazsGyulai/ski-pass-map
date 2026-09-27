import { describe, expect, it } from "vitest";
import { mapFitPadding } from "./map-padding";

describe("mapFitPadding", () => {
  it("keeps horizontal gutter symmetric on desktop because the dock is outside the canvas", () => {
    const padding = mapFitPadding({ narrow: false, sheetPx: 400, height: 800 });
    expect(padding.paddingTopLeft[0]).toBe(28);
    expect(padding.paddingBottomRight[0]).toBe(28);
  });

  it("keeps the mobile sheet out of the fitted bounds", () => {
    const padding = mapFitPadding({ narrow: true, sheetPx: 384, height: 800 });
    expect(padding.paddingTopLeft[0]).toBe(28);
    expect(padding.paddingBottomRight[1]).toBe(400);
    const full = mapFitPadding({ narrow: true, sheetPx: 716, height: 800 });
    expect(full.paddingBottomRight[1]).toBe(704);
  });
});
