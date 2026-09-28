/**
 * Lifts move on the map. Cars run uphill along each lift line (OSM draws lifts from the valley
 * station up): gondola cabins, chairs, T-bar hangers, platters and rope-tow grips, each type at its
 * own calm pace. Chevrons roll along magic carpets, and a cable car's two cabins shuttle past each
 * other. The cars are symbols on a small point source that moves every tick. Their spacing is in
 * screen pixels, so a lift reads the same at every zoom. Motion rests in background tabs and when
 * zoomed out. It is a setting, and the lift signs stay on the map either way.
 */
import { liftKind, type CarKind, type LiftKind } from "./lift-icons";

export const LIFT_CARS_SOURCE = "lift-cars";
export const LIFT_TICK_MS = 80;
/** Below this zoom the cars would blur into the line, so they are not drawn at all. */
export const LIFT_MOTION_MINZOOM = 12;

interface Flow {
  /** Cars in the order they hang on the rope; mixed lifts alternate cabins and chairs. */
  cars: CarKind[];
  spacingPx: number;
  speedPx: number;
}

/** Continuous lifts. A gondola runs faster and wider spaced than a chair; a magic carpet crawls. */
export const LIFT_FLOW: Partial<Record<LiftKind, Flow>> = {
  gondola: { cars: ["cabin"], spacingPx: 46, speedPx: 20 },
  mixed: { cars: ["cabin", "chair"], spacingPx: 30, speedPx: 18 },
  chair: { cars: ["chair"], spacingPx: 26, speedPx: 16 },
  drag: { cars: ["tbar"], spacingPx: 22, speedPx: 11 },
  platter: { cars: ["platter"], spacingPx: 22, speedPx: 11 },
  rope_tow: { cars: ["grip"], spacingPx: 16, speedPx: 9 },
  carpet: { cars: ["chevron"], spacingPx: 12, speedPx: 6 },
};

/** A cable car's cabins take this long to go up and come back down. */
export const SHUTTLE_SECONDS = 24;
/** Enough for the busiest resort in the data at close zoom. */
const MAX_CARS = 2000;

export interface LiftPath {
  kind: LiftKind;
  coords: Array<[number, number]>;
  /** Metres from the valley station to each vertex. */
  along: number[];
  length: number;
}

type LineFeature = { properties?: Record<string, unknown> | null; geometry?: { type?: string; coordinates?: unknown } | null };

/** The lifts in a resort's piste GeoJSON that have something to move. */
export function liftPaths(data: unknown): LiftPath[] {
  const features = (data as { features?: LineFeature[] } | null)?.features ?? [];
  const paths: LiftPath[] = [];
  for (const feature of features) {
    if (feature.properties?.kind !== "lift") continue;
    const aerialway = feature.properties.aerialway;
    const kind = liftKind(typeof aerialway === "string" ? aerialway : null);
    if (kind !== "cable_car" && !LIFT_FLOW[kind]) continue;
    const geometry = feature.geometry;
    const lines =
      geometry?.type === "LineString" ? [geometry.coordinates] : geometry?.type === "MultiLineString" ? (geometry.coordinates as unknown[]) : [];
    for (const line of lines) {
      if (!Array.isArray(line)) continue;
      const coords = line.filter(isLngLat).map((point): [number, number] => [point[0], point[1]]);
      if (coords.length < 2) continue;
      const along = [0];
      for (let i = 1; i < coords.length; i++) along.push(along[i - 1] + metres(coords[i - 1], coords[i]));
      const length = along[along.length - 1];
      if (length > 0) paths.push({ kind, coords, along, length });
    }
  }
  return paths;
}

function isLngLat(point: unknown): point is [number, number] {
  return Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]);
}

const RAD = Math.PI / 180;

/** Short lift segments, so a flat approximation is plenty. */
function metres(a: [number, number], b: [number, number]): number {
  const x = (b[0] - a[0]) * RAD * Math.cos(((a[1] + b[1]) / 2) * RAD);
  const y = (b[1] - a[1]) * RAD;
  return Math.hypot(x, y) * 6371008.8;
}

/** Ground metres per screen pixel, for the 512 px tiles both map libraries use. */
export function metresPerPixel(zoom: number, lat: number): number {
  return (2 * Math.PI * 6378137 * Math.cos(lat * RAD)) / (512 * 2 ** zoom);
}

function pointAt(path: LiftPath, distance: number): { lngLat: [number, number]; bearing: number } {
  let lo = 0;
  let hi = path.along.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.along[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const a = path.coords[lo];
  const b = path.coords[hi];
  const span = path.along[hi] - path.along[lo];
  const t = span > 0 ? Math.min(1, Math.max(0, (distance - path.along[lo]) / span)) : 0;
  const bearing = Math.atan2((b[0] - a[0]) * Math.cos(a[1] * RAD), b[1] - a[1]) / RAD;
  return { lngLat: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing };
}

export interface LiftCarFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  /** `rotate` turns a chevron along its belt: the glyph points east, so it is the bearing less 90°. */
  properties: { car: CarKind; rotate: number };
}

/** Where every car is `seconds` into the motion, at `metresPerPx` ground metres per screen pixel. */
export function liftCars(paths: LiftPath[], seconds: number, metresPerPx: number): LiftCarFeature[] {
  const cars: LiftCarFeature[] = [];
  const add = (path: LiftPath, distance: number, car: CarKind) => {
    const { lngLat, bearing } = pointAt(path, distance);
    cars.push({ type: "Feature", geometry: { type: "Point", coordinates: lngLat }, properties: { car, rotate: car === "chevron" ? bearing - 90 : 0 } });
  };
  for (const path of paths) {
    if (cars.length >= MAX_CARS) break;
    if (path.kind === "cable_car") {
      // The cabins meet halfway and rest a moment at the stations, where the cosine turns.
      const up = 0.5 - 0.5 * Math.cos((2 * Math.PI * seconds) / SHUTTLE_SECONDS);
      add(path, up * path.length, "cabin");
      add(path, (1 - up) * path.length, "cabin");
      continue;
    }
    const flow = LIFT_FLOW[path.kind];
    const spacing = flow ? flow.spacingPx * metresPerPx : 0;
    if (!flow || !(spacing > 0)) continue;
    const travelled = (seconds * flow.speedPx) / flow.spacingPx;
    const phase = travelled - Math.floor(travelled);
    // A car keeps its place in the order as it moves up one slot per spacing travelled.
    const turns = Math.floor(travelled);
    const count = flow.cars.length;
    for (let k = 0; cars.length < MAX_CARS; k++) {
      const distance = (phase + k) * spacing;
      if (distance > path.length) break;
      add(path, distance, flow.cars[(((k - turns) % count) + count) % count]);
    }
  }
  return cars;
}

/** The map surface the motion needs; both map libraries have these. */
export interface LiftMotionMap {
  getZoom(): number;
  getCenter(): { lat: number };
  getSource(id: string): { setData?: (data: unknown) => void } | undefined;
}

const EMPTY = { type: "FeatureCollection", features: [] };

/** Mapbox throws from getSource once style is gone (`style.getOwnSource`). A removed map is already clear. */
function carsSource(map: LiftMotionMap): { setData?: (data: unknown) => void } | undefined {
  try {
    return map.getSource(LIFT_CARS_SOURCE);
  } catch {
    return undefined;
  }
}

/**
 * Moves the cars on a timer and returns a stop function that clears them. The source is looked up
 * every tick, so a style swap in the middle is harmless: it comes back with the pistes.
 */
export function startLiftMotion(
  map: LiftMotionMap,
  paths: LiftPath[],
  env: { hidden: () => boolean; now: () => number } = { hidden: () => document.hidden, now: () => performance.now() },
): () => void {
  const tick = () => {
    const zoom = map.getZoom();
    if (env.hidden() || zoom < LIFT_MOTION_MINZOOM) return;
    const features = liftCars(paths, env.now() / 1000, metresPerPixel(zoom, map.getCenter().lat));
    carsSource(map)?.setData?.({ type: "FeatureCollection", features });
  };
  tick();
  const timer = setInterval(tick, LIFT_TICK_MS);
  return () => {
    clearInterval(timer);
    carsSource(map)?.setData?.(EMPTY);
  };
}
