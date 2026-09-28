import { mapFitPadding } from "./map-padding";
import { BASE_PATH } from "./site";
import {
  AUSTRIA_LAT,
  AUSTRIA_LNG,
  MAPLIBRE_ATTRIBUTION,
  OPENSKIMAP_ATTRIBUTION,
  styleFor,
  type MapAppearance,
  type MapProviderId,
} from "./map-styles";
import { pisteStyle, type PisteDifficulty } from "./pistes";
import { LIFT_CARS_SOURCE, LIFT_MOTION_MINZOOM } from "./lift-motion";
import {
  CAR_KINDS,
  LIFT_ICON_PIXEL_RATIO,
  LIFT_KINDS,
  drawLiftCar,
  drawLiftSign,
  liftCarImageId,
  liftKind,
  liftKindExpression,
  liftSignImageId,
  type LiftKind,
} from "./lift-icons";

export interface MapEvent {
  lngLat?: { lng: number; lat: number };
  point?: { x: number; y: number };
  originalEvent?: Event;
  error?: { status?: number; message?: string };
  tile?: unknown;
  sourceId?: string;
}

export interface VectorMap {
  on(type: string, listener: (event: MapEvent) => void): void;
  once(type: string, listener: (event: MapEvent) => void): void;
  off(type: string, listener: (event: MapEvent) => void): void;
  remove(): void;
  getZoom(): number;
  zoomOut(options?: { duration?: number }): void;
  getBounds(): { getSouth(): number; getWest(): number; getNorth(): number; getEast(): number };
  getContainer(): HTMLElement;
  getCanvas(): HTMLCanvasElement;
  resize(): void;
  fitBounds(bounds: [[number, number], [number, number]], options?: Record<string, unknown>): void;
  flyTo(options: {
    center: [number, number];
    zoom: number;
    duration?: number;
    padding?: { top: number; bottom: number; left: number; right: number };
    pitch?: number;
    bearing?: number;
  }): void;
  easeTo(options: { center?: [number, number]; zoom?: number; duration?: number; pitch?: number; bearing?: number }): void;
  /** The inset the camera keeps between moves. fitBounds fits inside it; flyTo with padding replaces it. */
  setPadding(padding: { top: number; bottom: number; left: number; right: number }): void;
  getPadding(): { top: number; bottom: number; left: number; right: number };
  getPitch(): number;
  getBearing(): number;
  /** Both libraries have these; the terrain module calls them. */
  setTerrain?(terrain: { source: string; exaggeration: number } | null): unknown;
  setSky?(sky: Record<string, unknown>): unknown;
  setFog?(fog: Record<string, unknown> | null): unknown;
  project(lngLat: [number, number]): { x: number; y: number };
  getCenter(): { lng: number; lat: number };
  addImage(id: string, image: { width: number; height: number; data: Uint8ClampedArray }, options?: { pixelRatio?: number }): void;
  hasImage(id: string): boolean;
  unproject(point: [number, number]): { lng: number; lat: number };
  addSource(id: string, source: unknown): void;
  getSource(id: string): VectorGeoJsonSource | undefined;
  removeSource(id: string): void;
  addLayer(layer: unknown, before?: string): void;
  getLayer(id: string): unknown;
  removeLayer(id: string): void;
  setPaintProperty(layer: string, name: string, value: unknown): void;
  getStyle(): { layers?: Array<{ id: string; type: string; "source-layer"?: string }> } | null | undefined;
  isStyleLoaded(): boolean;
  setStyle(style: string, options?: { diff?: boolean }): void;
  queryRenderedFeatures(
    geometry: [number, number] | [[number, number], [number, number]],
    options: { layers: string[] },
  ): RenderedFeature[];
  addControl(control: unknown, position?: string): void;
  removeControl(control: unknown): void;
  loaded(): boolean;
}

export interface RenderedFeature {
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown };
  layer?: { id?: string };
}

/**
 * GeoJSON source methods used here. MapLibre returns a promise from getClusterExpansionZoom;
 * Mapbox GL takes a callback. See clusterExpansionZoom.
 */
export interface VectorGeoJsonSource {
  setData?: (data: unknown) => void;
  getClusterExpansionZoom?: (clusterId: number, callback?: (error: unknown, zoom?: number) => void) => unknown;
}

/** Zoom at which a cluster falls apart, for either library. Null when it cannot be read. */
export function clusterExpansionZoom(source: VectorGeoJsonSource | undefined, clusterId: number): Promise<number | null> {
  return new Promise((resolve) => {
    const read = source?.getClusterExpansionZoom;
    if (!read) {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (zoom: number | null) => {
      if (settled) return;
      settled = true;
      resolve(zoom != null && Number.isFinite(zoom) ? zoom : null);
    };
    try {
      const result = read.call(source, clusterId, (error, zoom) => done(error ? null : (zoom ?? null)));
      if (result && typeof (result as Promise<number>).then === "function") {
        (result as Promise<number>).then(
          (zoom) => done(zoom),
          () => done(null),
        );
      }
    } catch {
      done(null);
    }
  });
}

export interface VectorMarker {
  setLngLat(lngLat: [number, number]): VectorMarker;
  addTo(map: VectorMap): VectorMarker;
  remove(): void;
  getElement(): HTMLElement;
}

export interface VectorPopup {
  setLngLat(lngLat: { lng: number; lat: number } | [number, number]): VectorPopup;
  setText(text: string): VectorPopup;
  addTo(map: VectorMap): VectorPopup;
  remove(): void;
}

export interface MapLib {
  accessToken?: string;
  Map: new (options: Record<string, unknown>) => VectorMap;
  Marker: new (options: { element: HTMLElement; anchor?: string }) => VectorMarker;
  NavigationControl: new (options?: { showCompass?: boolean; showZoom?: boolean; visualizePitch?: boolean }) => unknown;
  Popup: new (options?: { closeButton?: boolean; closeOnClick?: boolean; offset?: number; className?: string }) => VectorPopup;
}

export interface CreateMapOptions {
  container: HTMLElement;
  provider: MapProviderId;
  token?: string | null;
  theme: MapAppearance;
  reducedMotion?: boolean;
  onFatal?: () => void;
}

const FATAL_MESSAGE = /token|unauthorized|forbidden|not authorized|failed to fetch style|style.*not found/i;

export function createVectorMap(lib: MapLib, options: CreateMapOptions): VectorMap {
  const token = options.token?.trim() ?? "";
  if (options.provider === "mapbox" && !token) throw new Error("Mapbox token missing");
  if (options.provider === "mapbox") lib.accessToken = token;

  const customAttribution =
    options.provider === "mapbox" ? OPENSKIMAP_ATTRIBUTION : [MAPLIBRE_ATTRIBUTION, OPENSKIMAP_ATTRIBUTION];

  const probe = process.env.NEXT_PUBLIC_MAP_CANVAS_PROBE === "1";
  const map = new lib.Map({
    container: options.container,
    style: styleFor(options.provider, options.theme),
    center: [AUSTRIA_LNG, AUSTRIA_LAT],
    zoom: 7,
    minZoom: 4,
    maxZoom: 16,
    hash: false,
    fadeDuration: options.reducedMotion ? 0 : 300,
    failIfMajorPerformanceCaveat: false,
    preserveDrawingBuffer: probe,
    // Mapbox GL takes a boolean attributionControl and a top-level customAttribution; MapLibre
    // takes the options object. Either way the OpenSkiMap / ODbL credit must show.
    ...(options.provider === "mapbox"
      ? {
          accessToken: token,
          logoPosition: "bottom-left",
          attributionControl: true,
          customAttribution,
        }
      : { attributionControl: { compact: true, customAttribution } }),
  });

  let loaded = false;
  let reported = false;
  map.on("load", () => {
    loaded = true;
  });
  map.on("error", (event) => {
    if (options.provider !== "mapbox" || reported) return;
    const status = event.error?.status;
    const message = event.error?.message ?? "";
    const auth = status === 401 || status === 403;
    if (event.tile && !auth) return;
    const styleFailure = !loaded && FATAL_MESSAGE.test(message);
    if (!auth && !styleFailure) return;
    reported = true;
    options.onFatal?.();
  });
  return map;
}

/** Same-origin MapLibre worker. A leading slash keeps this off the basePath double-prefix. */
export function maplibreWorkerUrl(basePath: string = BASE_PATH): string {
  const prefix = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return `${prefix}/vendor/maplibre-gl-worker.js`;
}

export async function loadMapLibrary(provider: MapProviderId): Promise<{ lib: MapLib; token: string | null }> {
  if (provider === "mapbox") {
    const mod = await import("mapbox-gl");
    await import("mapbox-gl/dist/mapbox-gl.css");
    const lib = (mod.default ?? mod) as unknown as MapLib;
    return { lib, token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || null };
  }
  const mod = await import("maplibre-gl");
  await import("maplibre-gl/dist/maplibre-gl.css");
  mod.setWorkerUrl(maplibreWorkerUrl());
  return { lib: mod as unknown as MapLib, token: null };
}

export function hasMapSize(map: { getContainer(): HTMLElement }): boolean {
  const el = map.getContainer();
  return el.clientWidth >= 1 && el.clientHeight >= 1;
}

export function glFitPadding(height: number): { top: number; bottom: number; left: number; right: number } {
  const narrow = typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches;
  const raw = typeof document !== "undefined" ? Number(document.documentElement.dataset.sheetPx) : Number.NaN;
  const sheetPx = Number.isFinite(raw) && raw > 0 ? raw : null;
  const pad = mapFitPadding({ narrow, sheetPx, height });
  return {
    left: pad.paddingTopLeft[0],
    top: pad.paddingTopLeft[1],
    right: pad.paddingBottomRight[0],
    bottom: pad.paddingBottomRight[1],
  };
}

export function padLngLatBounds(
  points: Array<[number, number]>,
  ratio: number,
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of points) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const lonPad = Math.max(0.02, (east - west) * ratio);
  const latPad = Math.max(0.02, (north - south) * ratio);
  return [
    [west - lonPad, south - latPad],
    [east + lonPad, north + latPad],
  ];
}

export function boundsOfGeoJson(data: unknown): [[number, number], [number, number]] | null {
  const points: Array<[number, number]> = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      const lon = value[0];
      const lat = value[1];
      if (lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) points.push([lon, lat]);
      return;
    }
    for (const item of value) visit(item);
  };
  if (!data || typeof data !== "object" || !("features" in data)) return null;
  const features = (data as { features?: Array<{ geometry?: { coordinates?: unknown } }> }).features ?? [];
  for (const feature of features) visit(feature.geometry?.coordinates);
  return padLngLatBounds(points, 0.2);
}

export function motionDuration(preferredMs: number): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  return preferredMs;
}

const KNOWN: PisteDifficulty[] = ["novice", "easy", "intermediate", "advanced", "expert", "freeride"];

export interface PisteLayerSpec {
  id: string;
  filter: unknown[];
  color: string;
  width: number;
  dash?: number[];
  /** Butt caps keep moving dashes crisp; piste lines use round caps. */
  cap?: "round" | "butt";
  opacity?: number;
  minzoom?: number;
}

export const PISTE_SOURCE_ID = "resort-pistes";

export function pisteLayerSpecs(dark: boolean): PisteLayerSpec[] {
  const specs: PisteLayerSpec[] = KNOWN.filter((difficulty) => difficulty !== "expert").map((difficulty) => {
    const style = pisteStyle(difficulty, "piste");
    const color = dark && difficulty === "advanced" ? "#f4f4f5" : style.color;
    return {
      id: `piste-${difficulty}`,
      filter: ["all", ["==", ["get", "kind"], "piste"], ["==", ["get", "difficulty"], difficulty]],
      color,
      width: style.weight,
      dash: difficulty === "freeride" ? [2, 1.5] : undefined,
    };
  });
  const advanced = pisteStyle("advanced", "piste");
  specs.push({
    id: "piste-expert",
    filter: ["all", ["==", ["get", "kind"], "piste"], ["==", ["get", "difficulty"], "expert"]],
    color: dark ? "#f4f4f5" : advanced.color,
    width: advanced.weight,
  });
  specs.push({
    id: "piste-unknown",
    filter: [
      "all",
      ["==", ["get", "kind"], "piste"],
      ["!", ["in", ["coalesce", ["get", "difficulty"], ""], ["literal", KNOWN]]],
    ],
    color: pisteStyle("unknown", "piste").color,
    width: pisteStyle("unknown", "piste").weight,
  });
  const liftColor = dark ? "#e5e7eb" : pisteStyle(null, "lift").color;
  // The cable: every lift, thin and solid. Tips and taps land on it. Cars and signs sit on top.
  specs.push({ id: "piste-lift", filter: ["==", ["get", "kind"], "lift"], color: liftColor, width: 1.5, opacity: 0.8 });
  return specs;
}

export const LIFT_SIGN_LAYER = "lift-signs";
export const LIFT_CAR_LAYER = "lift-cars";
export const LIFT_BELT_LAYER = "lift-belts";

/**
 * Upright signs on each lift line: one near the valley station and more along a long lift, so a sign
 * is in view wherever you look. Signs give way to each other, not to place names.
 */
export function liftSignLayer(): Record<string, unknown> {
  return {
    id: LIFT_SIGN_LAYER,
    type: "symbol",
    source: PISTE_SOURCE_ID,
    minzoom: 11,
    filter: ["==", ["get", "kind"], "lift"],
    layout: {
      "symbol-placement": "line",
      "symbol-spacing": 360,
      "icon-image": ["concat", "lift-sign-", liftKindExpression()],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.66, 15, 1, 17, 1.15],
      "icon-rotation-alignment": "viewport",
      "icon-pitch-alignment": "viewport",
      "icon-padding": 2,
    },
  };
}

/** Cars hang under the cable and face the viewer; chevrons lie flat and point along the belt. */
export function liftCarLayers(): Array<Record<string, unknown>> {
  const layout = {
    "icon-image": ["concat", "lift-car-", ["get", "car"]],
    "icon-size": ["interpolate", ["linear"], ["zoom"], LIFT_MOTION_MINZOOM, 0.6, 16, 1],
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
  };
  return [
    {
      id: LIFT_CAR_LAYER,
      type: "symbol",
      source: LIFT_CARS_SOURCE,
      minzoom: LIFT_MOTION_MINZOOM,
      filter: ["!=", ["get", "car"], "chevron"],
      layout: { ...layout, "icon-anchor": "top", "icon-rotation-alignment": "viewport", "icon-pitch-alignment": "viewport" },
    },
    {
      id: LIFT_BELT_LAYER,
      type: "symbol",
      source: LIFT_CARS_SOURCE,
      minzoom: LIFT_MOTION_MINZOOM,
      filter: ["==", ["get", "car"], "chevron"],
      layout: { ...layout, "icon-rotate": ["get", "rotate"], "icon-rotation-alignment": "map", "icon-pitch-alignment": "map" },
    },
  ];
}

/** Sign and car images. A style swap drops them with the style, so this runs again after style.load. */
export function addLiftImages(map: VectorMap, dark: boolean): void {
  for (const kind of LIFT_KINDS) {
    const id = liftSignImageId(kind);
    const image = map.hasImage(id) ? null : drawLiftSign(kind);
    if (image) map.addImage(id, image, { pixelRatio: LIFT_ICON_PIXEL_RATIO });
  }
  for (const car of CAR_KINDS) {
    const id = liftCarImageId(car);
    const image = map.hasImage(id) ? null : drawLiftCar(car, dark);
    if (image) map.addImage(id, image, { pixelRatio: LIFT_ICON_PIXEL_RATIO });
  }
}

/** A piste or lift spec as a line layer on the resort's piste source. */
export function pisteLayer(spec: PisteLayerSpec): Record<string, unknown> {
  return {
    id: spec.id,
    type: "line",
    source: PISTE_SOURCE_ID,
    filter: spec.filter,
    ...(spec.minzoom != null ? { minzoom: spec.minzoom } : {}),
    layout: { "line-cap": spec.cap ?? "round", "line-join": "round" },
    paint: {
      "line-color": spec.color,
      "line-width": spec.width,
      "line-opacity": spec.opacity ?? 0.95,
      ...(spec.dash ? { "line-dasharray": spec.dash } : {}),
    },
  };
}

/** Line layers and lift signs: what tips and taps can land on. */
export function pisteLayerIds(): string[] {
  return [...pisteLayerSpecs(false).map((spec) => spec.id), LIFT_SIGN_LAYER];
}

/** Every layer on the resort's piste and car sources, top first, for removing them. */
export function resortRunLayerIds(): string[] {
  return [LIFT_SIGN_LAYER, LIFT_BELT_LAYER, LIFT_CAR_LAYER, ...pisteLayerSpecs(false).map((spec) => spec.id)];
}

export function firstLabelLayer(map: VectorMap): string | undefined {
  return map.getStyle()?.layers?.find((layer) => layer.type === "symbol")?.id;
}

export function pisteTip(
  properties: Record<string, unknown> | null | undefined,
  labels: {
    lift: string;
    novice: string;
    easy: string;
    intermediate: string;
    advanced: string;
    freeride: string;
    other: string;
    /** Names for each lift type; without them a lift shows its raw OSM type. */
    lifts?: Record<LiftKind, string>;
  },
): string {
  if (!properties) return "";
  const kind = properties.kind === "lift" ? "lift" : "piste";
  const name = typeof properties.name === "string" ? properties.name : "";
  const difficulty = typeof properties.difficulty === "string" ? properties.difficulty : "";
  const aerialway = typeof properties.aerialway === "string" ? properties.aerialway.replaceAll("_", " ") : "";
  const difficultyLabel =
    kind === "lift"
      ? labels.lift
      : difficulty === "novice"
        ? labels.novice
        : difficulty === "easy"
          ? labels.easy
          : difficulty === "intermediate"
            ? labels.intermediate
            : difficulty === "advanced" || difficulty === "expert"
              ? labels.advanced
              : difficulty === "freeride"
                ? labels.freeride
                : labels.other;
  const liftLabel = labels.lifts ? labels.lifts[liftKind(typeof properties.aerialway === "string" ? properties.aerialway : null)] : aerialway;
  return [name, kind === "lift" ? liftLabel || difficultyLabel : difficultyLabel].filter(Boolean).join(" · ");
}
