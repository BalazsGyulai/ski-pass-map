import type { VectorMap } from "./vector-map";
import { hasMapSize } from "./vector-map";

/** How close a resort's runs may fill the screen. The map itself allows 16. */
export const RESORT_MAX_ZOOM = 15;
/** A resort with no runs. Closer than the old overview step of 10. */
export const RESORT_POINT_ZOOM = 14;
/** Close enough to see the device dot against streets, without diving past a zoom the visitor already chose. */
export const USER_LOCATION_ZOOM = 12;

type Padding = { top: number; bottom: number; left: number; right: number };

/**
 * Caps padding so a short or narrow map keeps room for the resort. `panelPx` is the desktop side
 * panel floating over the map's left edge: it is never shrunk, and the caps apply to the map beside it.
 */
export function clampMapPadding(map: VectorMap, padding: Padding, panelPx = 0): Padding {
  const w = map.getContainer().clientWidth - panelPx;
  const h = map.getContainer().clientHeight;
  if (w < 2 || h < 2) return { ...padding, left: padding.left + panelPx };
  const maxVertical = Math.max(24, Math.floor(h * 0.42));
  const maxHorizontal = Math.max(16, Math.floor(w * 0.32));
  return {
    top: Math.min(padding.top, maxVertical),
    bottom: Math.min(padding.bottom, maxVertical),
    left: panelPx + Math.min(padding.left, maxHorizontal),
    right: Math.min(padding.right, maxHorizontal),
  };
}

/**
 * Camera padding that keeps the selected resort in the part of the map you can see.
 * On phones `sheetPx` is the visible height of the bottom sheet. A full sheet leaves only a strip,
 * so the padding is capped at half the map. The desktop side panel is added by clampMapPadding.
 */
export function resortCameraPadding(options: {
  narrow: boolean;
  sheetPx: number | null;
  height: number;
}): Padding {
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

/** How far the desktop side panel reaches over the map from its left edge. Zero on phones, where the list is a bottom sheet. */
export function readPanelInset(container: HTMLElement): number {
  if (typeof window === "undefined" || window.matchMedia("(max-width: 899px)").matches) return 0;
  const host = document.querySelector(".sheet-host");
  if (!host) return 0;
  return Math.max(0, Math.round(host.getBoundingClientRect().right - container.getBoundingClientRect().left));
}

/**
 * The map bounds you can see beside the side panel. Mapbox GL already leaves the map's padding out
 * of getBounds and MapLibre does not, so the west edge is whichever lies further east: the bounds' own
 * or the panel's edge. A rotated map keeps its full bounds.
 */
export function visibleBounds(map: VectorMap, panelPx: number): { south: number; west: number; north: number; east: number } {
  const bounds = map.getBounds();
  const full = { south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast() };
  const { clientWidth, clientHeight } = map.getContainer();
  if (panelPx <= 0 || clientWidth <= panelPx || Math.abs(map.getBearing()) > 1) return full;
  const edge = map.unproject([panelPx, clientHeight / 2]).lng;
  return Number.isFinite(edge) ? { ...full, west: Math.max(full.west, edge) } : full;
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
  options: { duration: number; padding: Padding; pitch?: number; panelPx?: number },
): void {
  if (!hasMapSize(map) || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
  // No runs to frame: come in to the point zoom, and leave a closer view alone.
  const zoom = Math.max(map.getZoom(), RESORT_POINT_ZOOM);
  // flyTo's padding replaces the map's own, so the side panel goes in here too.
  const padding = clampMapPadding(map, options.padding, options.panelPx ?? 0);
  map.flyTo({
    center: [lon, lat],
    zoom,
    duration: options.duration,
    padding,
    ...(options.pitch != null ? { pitch: options.pitch } : {}),
  });
}

export function flyToUser(
  map: VectorMap,
  lon: number,
  lat: number,
  options: { duration: number; padding: Padding; panelPx?: number },
): void {
  if (!hasMapSize(map) || !Number.isFinite(lon) || !Number.isFinite(lat)) return;
  const padding = clampMapPadding(map, options.padding, options.panelPx ?? 0);
  map.flyTo({
    center: [lon, lat],
    zoom: Math.max(map.getZoom(), USER_LOCATION_ZOOM),
    duration: options.duration,
    padding,
  });
}

export function fitResortBounds(
  map: VectorMap,
  bounds: [[number, number], [number, number]],
  options: { duration: number; padding: Padding; panelPx?: number; pitch?: number; replacePadding?: boolean },
): void {
  if (!hasMapSize(map)) return;
  const [[west, south], [east, north]] = bounds;
  if (![west, south, east, north].every(Number.isFinite)) return;
  if (west === east && south === north) {
    flyToResort(map, west, south, options);
    return;
  }
  // Mapbox replaces the map padding with this one, so the side panel has to be in it or the
  // resort is centred on the whole screen. MapLibre already counts the map's own padding.
  const padding = clampMapPadding(map, options.padding, options.replacePadding ? (options.panelPx ?? 0) : 0);
  map.fitBounds(bounds, {
    padding,
    maxZoom: RESORT_MAX_ZOOM,
    duration: options.duration,
    ...(options.pitch != null ? { pitch: options.pitch } : {}),
  });
}
