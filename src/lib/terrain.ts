import type { MapAppearance, MapProviderId } from "./map-styles";

/**
 * Relief and 3D terrain for both map libraries, from the free Terrain Tiles on AWS Open Data
 * (terrarium encoded; Austria comes from the 10 m DGM Österreich). No key, no per-load cost.
 */
export const TERRAIN_TILES = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png";
export const TERRAIN_HOST = "https://elevation-tiles-prod.s3.amazonaws.com";
/** Short on the map; the linked page and Credits list every elevation source (DGM Österreich, EU-DEM, SRTM…). */
export const TERRAIN_ATTRIBUTION =
  '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Terrain Tiles</a>';

/** Separate sources for shading and 3D, as MapLibre recommends; the browser caches the shared tiles. */
export const TERRAIN_SOURCE = "terrain-dem";
export const HILLSHADE_SOURCE = "terrain-hillshade-dem";
export const HILLSHADE_LAYER = "terrain-hillshade";

/** A little extra height reads better on a phone; more makes the Alps look fake. */
export const TERRAIN_EXAGGERATION = 1.3;
/** Camera tilt when a resort opens with 3D on. */
export const RESORT_PITCH = 55;

export interface DemSource {
  type: "raster-dem";
  tiles: string[];
  tileSize: number;
  encoding: "terrarium";
  maxzoom: number;
  attribution?: string;
}

/**
 * Zoom 12 (about 30 m) is plenty for shading and for a resort-sized 3D surface. Both sources ask
 * for the same tiles, so the browser fetches each only once, and the map stays light on phones.
 */
export function demSource(use: "terrain" | "hillshade"): DemSource {
  return {
    type: "raster-dem",
    tiles: [TERRAIN_TILES],
    tileSize: 256,
    encoding: "terrarium",
    maxzoom: 12,
    ...(use === "hillshade" ? { attribution: TERRAIN_ATTRIBUTION } : {}),
  };
}

export function hillshadeLayer(appearance: MapAppearance) {
  const dark = appearance === "dark";
  return {
    id: HILLSHADE_LAYER,
    type: "hillshade",
    source: HILLSHADE_SOURCE,
    paint: {
      "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 6, 0.3, 10, 0.4, 14, 0.28],
      "hillshade-shadow-color": dark ? "#000000" : "#5b6778",
      "hillshade-highlight-color": dark ? "#2a3446" : "#ffffff",
      "hillshade-accent-color": dark ? "#0b111c" : "#94a3b8",
    },
  };
}

interface StyleLayerLike {
  id: string;
  type: string;
  "source-layer"?: string;
}

const ABOVE_RELIEF = new Set(["transportation", "transportation_name", "building", "aeroway", "boundary", "road", "admin", "structure"]);

/**
 * The layer the shading goes under: the first road, building, border or label, so relief sits on
 * land and water but under everything you read. Falls back to the first label.
 */
export function hillshadeBefore(layers: StyleLayerLike[] | undefined): string | undefined {
  if (!layers) return undefined;
  const hit = layers.find((layer) => layer.type === "symbol" || (layer["source-layer"] != null && ABOVE_RELIEF.has(layer["source-layer"])));
  return hit?.id;
}

/** Horizon colours for a tilted camera, in the calm page palette (MapLibre sky). */
export function skyFor(appearance: MapAppearance) {
  const dark = appearance === "dark";
  return {
    "sky-color": dark ? "#0a0e17" : "#dfe8f2",
    "horizon-color": dark ? "#1a2233" : "#f4f5f7",
    "fog-color": dark ? "#0a0e17" : "#eef1f4",
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.7,
    "fog-ground-blend": 0.7,
    "atmosphere-blend": 0,
  };
}

/** The same horizon for Mapbox GL, which calls it fog. */
export function fogFor(appearance: MapAppearance) {
  const dark = appearance === "dark";
  return {
    color: dark ? "#141b2a" : "#eef1f4",
    "high-color": dark ? "#0a0e17" : "#dfe8f2",
    "horizon-blend": 0.08,
    "space-color": dark ? "#05070c" : "#dfe8f2",
    "star-intensity": 0,
  };
}

/**
 * 3D starts on, except where it would hurt: little memory (Chrome reports it) or a request to save
 * data. Anyone can switch it in the layers panel or Settings.
 */
export function defaultTerrain3d(env: { deviceMemory?: number; saveData?: boolean; reducedData?: boolean }): boolean {
  if (typeof env.deviceMemory === "number" && env.deviceMemory > 0 && env.deviceMemory <= 2) return false;
  if (env.saveData || env.reducedData) return false;
  return true;
}

/** Minimal map surface the terrain code needs; both libraries have these. */
export interface TerrainMap {
  addSource(id: string, source: unknown): void;
  getSource(id: string): unknown;
  addLayer(layer: unknown, before?: string): void;
  getLayer(id: string): unknown;
  getStyle(): { layers?: StyleLayerLike[] } | null | undefined;
  setTerrain?(terrain: { source: string; exaggeration: number } | null): unknown;
  setSky?(sky: Record<string, unknown>): unknown;
  setFog?(fog: Record<string, unknown> | null): unknown;
}

/**
 * Adds the relief shading (always) and the 3D surface (when `threeD`) to the current style.
 * Safe to call again after every style load; it only adds what is missing.
 */
export function applyTerrain(map: TerrainMap, options: { provider: MapProviderId; appearance: MapAppearance; threeD: boolean }): void {
  if (!map.getSource(HILLSHADE_SOURCE)) map.addSource(HILLSHADE_SOURCE, demSource("hillshade"));
  if (!map.getLayer(HILLSHADE_LAYER)) {
    const before = hillshadeBefore(map.getStyle()?.layers);
    if (before) map.addLayer(hillshadeLayer(options.appearance), before);
    else map.addLayer(hillshadeLayer(options.appearance));
  }
  if (options.threeD) {
    if (!map.getSource(TERRAIN_SOURCE)) map.addSource(TERRAIN_SOURCE, demSource("terrain"));
    map.setTerrain?.({ source: TERRAIN_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
    if (options.provider === "mapbox") map.setFog?.(fogFor(options.appearance));
    else map.setSky?.(skyFor(options.appearance));
  } else {
    map.setTerrain?.(null);
    if (options.provider === "mapbox") map.setFog?.(null);
  }
}
