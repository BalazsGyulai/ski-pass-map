export type BottomOverlayKind = "consent" | "support" | "cookie-settings" | null;

export function setBottomOverlay(kind: BottomOverlayKind, heightPx = 0): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!kind || heightPx <= 0) {
    delete root.dataset.bottomOverlay;
    root.style.removeProperty("--bottom-overlay-height");
    return;
  }
  root.dataset.bottomOverlay = kind;
  root.style.setProperty("--bottom-overlay-height", `${Math.ceil(heightPx)}px`);
}

/** Room a bottom-fixed overlay takes from the viewport bottom: its offset plus its height (transforms ignored). */
export function overlayClearance(host: HTMLElement): number {
  const bottom = Number.parseFloat(getComputedStyle(host).bottom);
  return (Number.isFinite(bottom) ? bottom : 0) + host.offsetHeight;
}
