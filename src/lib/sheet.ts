export type SheetSnap = "peek" | "half" | "full";

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
