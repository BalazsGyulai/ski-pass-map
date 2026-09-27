export type SheetSnap = "peek" | "half" | "full";

/** Fired on window when a mobile sheet settles. detail: { visible: number } in px. */
export const SHEET_EVENT = "skimap-sheet";

/** Keyboard equivalent of dragging the mobile sheet handle. */
export function snapFromKey(current: SheetSnap, key: string): SheetSnap | "close" | null {
  if (key === "ArrowUp" || key === "ArrowRight") {
    const next = nextSheetSnap(current, "up");
    return next === "close" ? current : next;
  }
  if (key === "ArrowDown" || key === "ArrowLeft") return nextSheetSnap(current, "down");
  if (key === "Home") return "peek";
  if (key === "End") return "full";
  return null;
}

/** List sheet never dismisses. Down from peek stays at peek. */
export function nextListSnap(current: SheetSnap, direction: "up" | "down"): SheetSnap {
  const next = nextSheetSnap(current, direction);
  return next === "close" ? "peek" : next;
}

/** Next snap after a vertical drag. Down from the peek state closes the resort. */
export function nextSheetSnap(current: SheetSnap, direction: "up" | "down"): SheetSnap | "close" {
  if (direction === "up") {
    if (current === "peek") return "half";
    return "full";
  }
  if (current === "full") return "half";
  if (current === "half") return "peek";
  return "close";
}

/** Visible heights, in pixels, for each snap of a mobile bottom sheet. */
export interface SheetMetrics {
  peek: number;
  half: number;
  full: number;
}

/** Space kept above a full sheet so the search pill stays visible. */
export const SHEET_TOP_GAP = 84;

export function sheetMetrics(kind: "list" | "resort", available: number): SheetMetrics {
  const full = Math.max(160, Math.round(available - SHEET_TOP_GAP));
  const peekTarget = kind === "list" ? 196 : 300;
  const peek = Math.min(peekTarget, Math.round(available * 0.42), full);
  const half = Math.min(full, Math.max(peek + 40, Math.round(available * 0.52)));
  return { peek, half, full };
}

/** Diminishing pull past the ends, like a native sheet. */
export function rubberBand(overshoot: number, limit = 120): number {
  if (overshoot <= 0) return 0;
  return limit * (1 - 1 / (overshoot / limit + 1));
}

/**
 * Where a released drag comes to rest. `visible` is the sheet's height on screen at release and
 * `velocity` is px/ms, positive while the sheet moves down. The momentum is projected forward,
 * so a quick flick carries past the nearest snap.
 */
export function settleSnap(options: {
  visible: number;
  velocity: number;
  metrics: SheetMetrics;
  closable: boolean;
}): SheetSnap | "close" {
  const { visible, velocity, metrics, closable } = options;
  const projected = visible - velocity * 240;
  const points: Array<[SheetSnap | "close", number]> = [
    ["peek", metrics.peek],
    ["half", metrics.half],
    ["full", metrics.full],
  ];
  if (closable) points.unshift(["close", 0]);
  let best = points[0];
  for (const point of points) {
    if (Math.abs(point[1] - projected) < Math.abs(best[1] - projected)) best = point;
  }
  // Closing needs a clear pull below the peek, not a small wobble.
  if (best[0] === "close" && visible > metrics.peek * 0.7 && velocity < 0.9) return "peek";
  return best[0];
}

/** Settle animation length: short hops are quick, long throws take a little longer. */
export function settleDuration(distance: number, velocity: number): number {
  const base = 180 + Math.abs(distance) * 0.45;
  const fast = Math.abs(velocity) > 1 ? 0.75 : 1;
  return Math.round(Math.min(460, Math.max(200, base * fast)));
}
