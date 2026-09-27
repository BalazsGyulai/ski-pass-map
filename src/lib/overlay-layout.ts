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
