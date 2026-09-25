export type SheetSnap = "peek" | "half" | "full";

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
