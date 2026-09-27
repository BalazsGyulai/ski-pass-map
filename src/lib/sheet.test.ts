import { describe, expect, it } from "vitest";
import { SHEET_TOP_GAP, nextListSnap, nextSheetSnap, rubberBand, settleDuration, settleSnap, sheetMetrics, snapFromKey } from "./sheet";

describe("nextSheetSnap", () => {
  it("expands peek to half to full", () => {
    expect(nextSheetSnap("peek", "up")).toBe("half");
    expect(nextSheetSnap("half", "up")).toBe("full");
    expect(nextSheetSnap("full", "up")).toBe("full");
  });

  it("collapses full to half to peek, then closes", () => {
    expect(nextSheetSnap("full", "down")).toBe("half");
    expect(nextSheetSnap("half", "down")).toBe("peek");
    expect(nextSheetSnap("peek", "down")).toBe("close");
  });
});

describe("nextListSnap", () => {
  it("stops at peek instead of closing the list", () => {
    expect(nextListSnap("peek", "down")).toBe("peek");
    expect(nextListSnap("half", "down")).toBe("peek");
    expect(nextListSnap("peek", "up")).toBe("half");
  });
});

describe("snapFromKey", () => {
  it("maps arrows, Home, and End onto the same snaps", () => {
    expect(snapFromKey("peek", "ArrowUp")).toBe("half");
    expect(snapFromKey("half", "ArrowDown")).toBe("peek");
    expect(snapFromKey("peek", "ArrowDown")).toBe("close");
    expect(snapFromKey("full", "Home")).toBe("peek");
    expect(snapFromKey("peek", "End")).toBe("full");
    expect(snapFromKey("half", "Enter")).toBeNull();
  });
});

describe("sheet physics", () => {
  const metrics = sheetMetrics("list", 760);

  it("sizes snaps from the space available", () => {
    expect(metrics.full).toBe(760 - SHEET_TOP_GAP);
    expect(metrics.peek).toBe(196);
    expect(metrics.half).toBe(Math.round(760 * 0.52));
    const small = sheetMetrics("resort", 400);
    expect(small.peek).toBeLessThanOrEqual(small.half);
    expect(small.half).toBeLessThanOrEqual(small.full);
  });

  it("settles on the nearest snap when released slowly", () => {
    expect(settleSnap({ visible: metrics.half + 30, velocity: 0, metrics, closable: false })).toBe("half");
    expect(settleSnap({ visible: metrics.full - 20, velocity: 0, metrics, closable: false })).toBe("full");
  });

  it("follows a flick past the nearest snap", () => {
    expect(settleSnap({ visible: metrics.half, velocity: -1.4, metrics, closable: false })).toBe("full");
    expect(settleSnap({ visible: metrics.half, velocity: 1.2, metrics, closable: false })).toBe("peek");
  });

  it("only closes a resort sheet on a clear pull down", () => {
    expect(settleSnap({ visible: metrics.peek - 20, velocity: 0.2, metrics, closable: true })).toBe("peek");
    expect(settleSnap({ visible: metrics.peek * 0.4, velocity: 0.3, metrics, closable: true })).toBe("close");
    expect(settleSnap({ visible: metrics.peek, velocity: 1.6, metrics, closable: true })).toBe("close");
    expect(settleSnap({ visible: 40, velocity: 0, metrics, closable: false })).toBe("peek");
  });

  it("resists past the ends and keeps settle times short", () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(60)).toBeLessThan(60);
    expect(rubberBand(10_000)).toBeLessThan(120);
    expect(settleDuration(10, 0)).toBe(200);
    expect(settleDuration(900, 0)).toBe(460);
  });
});
