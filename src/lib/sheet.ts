/** shut is only the handle. bar is the title. The resort stays selected at both. */
export type SheetSnap = "shut" | "bar" | "peek" | "half" | "full";

export const SHEET_SNAPS = ["shut", "bar", "peek", "half", "full"] as const satisfies readonly SheetSnap[];
export const SHEET_SNAP_MAX = SHEET_SNAPS.length - 1;

/** Fired on window when a mobile sheet settles. detail: { visible: number } in px. */
export const SHEET_EVENT = "skimap-sheet";

export function sheetSnapValue(snap: SheetSnap): number {
  return SHEET_SNAPS.indexOf(snap);
}

/** Keyboard equivalent of dragging the mobile sheet handle. Home is the handle, End is full. */
export function snapFromKey(current: SheetSnap, key: string): SheetSnap | null {
  if (key === "ArrowUp" || key === "ArrowRight") return nextSheetSnap(current, "up");
  if (key === "ArrowDown" || key === "ArrowLeft") return nextSheetSnap(current, "down");
  if (key === "Home") return "shut";
  if (key === "End") return "full";
  return null;
}

/** The list never leaves the page. Down from the handle stays on the handle. */
export function nextListSnap(current: SheetSnap, direction: "up" | "down"): SheetSnap {
  return nextSheetSnap(current, direction);
}

/** One step up or down the sheet. The ends stay put. */
export function nextSheetSnap(current: SheetSnap, direction: "up" | "down"): SheetSnap {
  const index = SHEET_SNAPS.indexOf(current);
  const next = direction === "up" ? index + 1 : index - 1;
  return SHEET_SNAPS[Math.min(SHEET_SNAPS.length - 1, Math.max(0, next))];
}

/** Visible heights, in pixels, for each snap of a mobile bottom sheet. */
export interface SheetMetrics {
  shut: number;
  bar: number;
  peek: number;
  half: number;
  full: number;
}

/** Space kept above a full sheet so the search pill stays visible. */
export const SHEET_TOP_GAP = 84;

export function sheetMetrics(kind: "list" | "resort", available: number): SheetMetrics {
  const full = Math.max(160, Math.round(available - SHEET_TOP_GAP));
  const shut = Math.min(44, full);
  // The list bar is the heading. The resort bar is the name, on up to three lines.
  let bar = Math.min(kind === "list" ? 120 : 156, full);
  let peek = Math.min(kind === "list" ? 196 : 300, Math.round(available * 0.42), full);
  if (bar > peek) bar = peek;
  if (bar < shut) bar = shut;
  if (peek < bar) peek = bar;
  const half = Math.min(full, Math.max(peek + 40, Math.round(available * 0.52)));
  return { shut, bar, peek, half, full };
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
export function settleSnap(options: { visible: number; velocity: number; metrics: SheetMetrics }): SheetSnap {
  const { visible, velocity, metrics } = options;
  const projected = visible - velocity * 240;
  const points: Array<[SheetSnap, number]> = [
    ["shut", metrics.shut],
    ["bar", metrics.bar],
    ["peek", metrics.peek],
    ["half", metrics.half],
    ["full", metrics.full],
  ];
  let best = points[0];
  for (const point of points) {
    if (Math.abs(point[1] - projected) < Math.abs(best[1] - projected)) best = point;
  }
  return best[0];
}

/** Settle animation length: short hops are quick, long throws take a little longer. */
export function settleDuration(distance: number, velocity: number): number {
  const base = 180 + Math.abs(distance) * 0.45;
  const fast = Math.abs(velocity) > 1 ? 0.75 : 1;
  return Math.round(Math.min(460, Math.max(200, base * fast)));
}
