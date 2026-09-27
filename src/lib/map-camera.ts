import type { VectorMap } from "./vector-map";
import { hasMapSize } from "./vector-map";

export const RESORT_MAX_ZOOM = 13;

export function clampMapPadding(
  map: VectorMap,
  padding: { top: number; bottom: number; left: number; right: number },
): { top: number; bottom: number; left: number; right: number } {
  const w = map.getContainer().clientWidth;
  const h = map.getContainer().clientHeight;
  if (w < 2 || h < 2) return padding;
  const maxVertical = Math.max(24, Math.floor(h * 0.42));
  const maxHorizontal = Math.max(16, Math.floor(w * 0.32));
  return {
    top: Math.min(padding.top, maxVertical),
    bottom: Math.min(padding.bottom, maxVertical),
    left: Math.min(padding.left, maxHorizontal),
    right: Math.min(padding.right, maxHorizontal),
  };
}

/**
 * Camera padding that keeps the selected resort in the part of the map you can see.
 * On phones `sheetPx` is the visible height of the bottom sheet. A full sheet leaves only a strip,
 * so the padding is capped at half the map.
 */
export function resortCameraPadding(options: {
  narrow: boolean;
  sheetPx: number | null;
  height: number;
}): { top: number; bottom: number; left: number; right: number } {
  if (!options.narrow) {
    return { top: 72, bottom: 48, left: 32, right: 32 };
  }
  const sheet = options.sheetPx ?? Math.round(options.height * 0.5);
  const bottom = Math.min(Math.round(options.height * 0.5), sheet + 16);
  return { top: 88, bottom, left: 24, right: 24 };
}

/** Visible height of the mobile sheet in px, published by useBottomSheet. */
export function readSheetVisible(): number | null {
  if (typeof document === "undefined") return null;
  const raw = Number(document.documentElement.dataset.sheetPx);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function whenMapIdle(map: VectorMap): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      map.off("idle", done);
      resolve();
    };
    if (map.loaded() && map.isStyleLoaded()) {
      map.once("idle", done);
      return;
    }
    map.on("idle", done);
  });
}

export function flyToResort(
  map: VectorMap,
  lon: number,
  lat: number,
  options: { duration: number; padding: { top: number; bottom: number; left: number; right: number } },
): void {
  if (!hasMapSize(map) || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
  const zoom = Math.min(RESORT_MAX_ZOOM, Math.max(map.getZoom(), 10));
  const padding = clampMapPadding(map, options.padding);
  map.flyTo({
    center: [lon, lat],
    zoom,
    duration: options.duration,
    padding,
  });
}

export function fitResortBounds(
  map: VectorMap,
  bounds: [[number, number], [number, number]],
  options: { duration: number; padding: { top: number; bottom: number; left: number; right: number } },
): void {
  if (!hasMapSize(map)) return;
  const [[west, south], [east, north]] = bounds;
  if (![west, south, east, north].every(Number.isFinite)) return;
  if (west === east && south === north) {
    flyToResort(map, west, south, options);
    return;
  }
  map.fitBounds(bounds, {
    padding: clampMapPadding(map, options.padding),
    maxZoom: RESORT_MAX_ZOOM,
    duration: options.duration,
  });
}
