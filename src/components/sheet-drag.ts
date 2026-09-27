import { nextListSnap, nextSheetSnap, type SheetSnap } from "@/lib/sheet";

export function startSheetDrag(
  event: React.PointerEvent<HTMLElement>,
  options: {
    snap: SheetSnap;
    apply: (next: SheetSnap) => void;
    close?: () => void;
    sheet: HTMLElement | null;
    mode: "list" | "resort";
  },
) {
  if (!window.matchMedia("(max-width: 899px)").matches) return;
  if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
  const origin = options.snap;
  const startY = event.clientY;
  let lastY = startY;
  const handle = event.currentTarget;
  handle.setPointerCapture(event.pointerId);
  const move = (ev: PointerEvent) => {
    lastY = ev.clientY;
    const dy = Math.max(-140, Math.min(180, lastY - startY));
    options.sheet?.style.setProperty("transform", `translateY(${dy}px)`);
    options.sheet?.style.setProperty("transition", "none");
  };
  const end = () => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    options.sheet?.style.removeProperty("transform");
    options.sheet?.style.removeProperty("transition");
    const dy = lastY - startY;
    if (dy > 48) {
      if (options.mode === "list") options.apply(nextListSnap(origin, "down"));
      else {
        const next = nextSheetSnap(origin, "down");
        if (next === "close") options.close?.();
        else options.apply(next);
      }
    } else if (dy < -48) {
      options.apply(options.mode === "list" ? nextListSnap(origin, "up") : (nextSheetSnap(origin, "up") as SheetSnap));
    }
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}
