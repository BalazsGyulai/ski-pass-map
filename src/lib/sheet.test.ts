import { describe, expect, it } from "vitest";
import { SHEET_SNAP_MAX, SHEET_TOP_GAP, nextListSnap, nextSheetSnap, rubberBand, settleDuration, settleSnap, sheetMetrics, sheetSnapValue, snapFromKey } from "./sheet";

describe("nextSheetSnap", () => {
  it("expands from the handle up to full, one step at a time", () => {
    expect(nextSheetSnap("shut", "up")).toBe("bar");
    expect(nextSheetSnap("bar", "up")).toBe("peek");
    expect(nextSheetSnap("peek", "up")).toBe("half");
    expect(nextSheetSnap("half", "up")).toBe("full");
    expect(nextSheetSnap("full", "up")).toBe("full");
  });

  it("shortens from full down to the handle and stays there", () => {
    expect(nextSheetSnap("full", "down")).toBe("half");
    expect(nextSheetSnap("half", "down")).toBe("peek");
    expect(nextSheetSnap("peek", "down")).toBe("bar");
    expect(nextSheetSnap("bar", "down")).toBe("shut");
    expect(nextSheetSnap("shut", "down")).toBe("shut");
  });
});

describe("nextListSnap", () => {
  it("stops at the handle instead of removing the list", () => {
    expect(nextListSnap("peek", "down")).toBe("bar");
    expect(nextListSnap("bar", "down")).toBe("shut");
    expect(nextListSnap("shut", "down")).toBe("shut");
    expect(nextListSnap("shut", "up")).toBe("bar");
  });
});

describe("snapFromKey", () => {
  it("maps arrows, Home, and End onto the same snaps", () => {
    expect(snapFromKey("peek", "ArrowUp")).toBe("half");
    expect(snapFromKey("half", "ArrowDown")).toBe("peek");
    expect(snapFromKey("shut", "ArrowDown")).toBe("shut");
    expect(snapFromKey("full", "Home")).toBe("shut");
    expect(snapFromKey("peek", "End")).toBe("full");
    expect(snapFromKey("half", "Enter")).toBeNull();
    expect(sheetSnapValue("shut")).toBe(0);
    expect(sheetSnapValue("full")).toBe(SHEET_SNAP_MAX);
  });
});

describe("sheet physics", () => {
  const metrics = sheetMetrics("list", 760);

  it("sizes snaps from the space available", () => {
    expect(metrics.full).toBe(760 - SHEET_TOP_GAP);
    expect(metrics.shut).toBe(44);
    expect(metrics.bar).toBe(120);
    expect(metrics.peek).toBe(196);
    expect(metrics.half).toBe(Math.round(760 * 0.52));
    const resort = sheetMetrics("resort", 760);
    expect(resort.bar).toBe(156);
    expect(resort.peek).toBe(300);
    const small = sheetMetrics("resort", 400);
    expect(small.shut).toBeLessThanOrEqual(small.bar);
    expect(small.bar).toBeLessThanOrEqual(small.peek);
    expect(small.peek).toBeLessThanOrEqual(small.half);
    expect(small.half).toBeLessThanOrEqual(small.full);
  });

  it("settles on the nearest snap when released slowly", () => {
    expect(settleSnap({ visible: metrics.half + 30, velocity: 0, metrics })).toBe("half");
    expect(settleSnap({ visible: metrics.full - 20, velocity: 0, metrics })).toBe("full");
    expect(settleSnap({ visible: metrics.bar + 4, velocity: 0, metrics })).toBe("bar");
  });

  it("follows a flick past the nearest snap", () => {
    expect(settleSnap({ visible: metrics.half, velocity: -1.4, metrics })).toBe("full");
    expect(settleSnap({ visible: metrics.half, velocity: 1.2, metrics })).toBe("bar");
  });

  it("settles on the handle when pulled down past the name", () => {
    expect(settleSnap({ visible: metrics.bar * 0.35, velocity: 0.2, metrics })).toBe("shut");
    expect(settleSnap({ visible: 20, velocity: 0, metrics })).toBe("shut");
  });

  it("resists past the ends and keeps settle times short", () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(60)).toBeLessThan(60);
    expect(rubberBand(10_000)).toBeLessThan(120);
    expect(settleDuration(10, 0)).toBe(200);
    expect(settleDuration(900, 0)).toBe(460);
  });
});
