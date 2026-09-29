import { describe, expect, it } from "vitest";
import { placeLanguageMenu } from "./language-menu";

const desktop = { width: 1280, height: 800, limitBottom: 800 };

describe("placeLanguageMenu", () => {
  it("opens downward and lines up with the trigger's right edge", () => {
    const place = placeLanguageMenu({ top: 12, right: 1200, bottom: 52, width: 88 }, desktop);
    expect(place.top).toBe(58);
    expect(place.bottom).toBeUndefined();
    expect(place.left + place.width).toBe(1200);
    expect(place.maxHeight).toBe(420);
  });

  it("stays inside the screen when the trigger is at the left", () => {
    const place = placeLanguageMenu({ top: 12, right: 80, bottom: 52, width: 64 }, desktop);
    expect(place.left).toBe(8);
    expect(place.left + place.width).toBeLessThanOrEqual(desktop.width - 8);
  });

  it("opens upward when the tab bar leaves little room below", () => {
    const place = placeLanguageMenu(
      { top: 640, right: 300, bottom: 680, width: 120 },
      { width: 390, height: 800, limitBottom: 744 },
    );
    expect(place.top).toBeUndefined();
    expect(place.bottom).toBe(800 - 640 + 6);
    expect(place.maxHeight).toBeLessThanOrEqual(640 - 6 - 8);
  });
});
