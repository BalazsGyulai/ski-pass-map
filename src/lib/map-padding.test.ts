import { describe, expect, it } from "vitest";
import { mapFitPadding } from "./map-padding";

describe("mapFitPadding", () => {
  it("reserves the desktop dock on the left and only a gutter on the right", () => {
    const padding = mapFitPadding({ narrow: false, sheet: "half", height: 800 });
    expect(padding.paddingTopLeft[0]).toBe(420);
    expect(padding.paddingBottomRight[0]).toBe(28);
  });

  it("keeps the mobile sheet out of the fitted bounds", () => {
    const padding = mapFitPadding({ narrow: true, sheet: "half", height: 800 });
    expect(padding.paddingTopLeft[0]).toBe(28);
    expect(padding.paddingBottomRight[1]).toBe(400);
  });
});
