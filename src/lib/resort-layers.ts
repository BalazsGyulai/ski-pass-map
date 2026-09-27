import type { MapAppearance, MapProviderId } from "./map-styles";

/**
 * Resorts are drawn by the map engine itself: one GeoJSON source with native clustering,
 * circle layers for the dots, and symbol layers for labels. Nothing is rebuilt in the DOM
 * when the camera moves, so panning and zooming stay smooth.
 */
export const RESORT_SOURCE = "resorts";
/** Selected and hovered resorts. Never clustered, always on top. */
export const FOCUS_SOURCE = "resort-focus";

export const RESORT_LAYERS = {
  clusterShadow: "resorts-cluster-shadow",
  cluster: "resorts-cluster",
  clusterCount: "resorts-cluster-count",
  ring: "resorts-ring",
  dot: "resorts-dot",
  planned: "resorts-planned",
  label: "resorts-label",
  labelNoPass: "resorts-label-nopass",
  focusGlow: "resort-focus-glow",
  focusRing: "resort-focus-ring",
  focusDot: "resort-focus-dot",
  focusLabel: "resort-focus-label",
} as const;

/** Layers a tap can land on, most specific first. */
export const RESORT_HIT_LAYERS = [RESORT_LAYERS.focusDot, RESORT_LAYERS.dot, RESORT_LAYERS.cluster] as const;

export const NO_PASS_COLOR = "#98a2b3";
/** Resorts stop clustering from this zoom on. */
export const UNCLUSTER_ZOOM = 9;
export const CLUSTER_RADIUS = 44;

export interface ResortPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  passes: string[];
  abandoned?: boolean;
}

export interface ResortFeatureContext {
  colorOf(passId: string): string | undefined;
  shortNameOf(passId: string): string | undefined;
  plannedDays?: Record<string, number>;
}

export interface ResortFeatureProperties {
  id: string;
  name: string;
  /** Colour of the first covering pass, grey when nothing covers the resort. */
  c1: string;
  /** Colour of the second covering pass. Same as c1 for single-pass resorts. */
  c2: string;
  multi: boolean;
  noPass: boolean;
  closed: boolean;
  days: number;
  /** Short pass label, e.g. "Ski amadé +1". Empty when no pass covers the resort. */
  pass: string;
  /** Label priority. Lower wins when labels collide. */
  rank: number;
  kind?: "selected" | "hot";
}

export interface ResortFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: ResortFeatureProperties;
}

export interface ResortFeatureCollection {
  type: "FeatureCollection";
  features: ResortFeature[];
}

export function safeColor(value: string | undefined | null, fallback: string = NO_PASS_COLOR): string {
  return value && /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : fallback;
}

export function passLabel(shortNames: string[]): string {
  if (shortNames.length === 0) return "";
  return shortNames.length === 1 ? shortNames[0] : `${shortNames[0]} +${shortNames.length - 1}`;
}

export function resortFeature(resort: ResortPoint, context: ResortFeatureContext, kind?: "selected" | "hot"): ResortFeature | null {
  if (!Number.isFinite(resort.lat) || !Number.isFinite(resort.lon)) return null;
  const known = resort.passes.filter((id) => context.colorOf(id) != null);
  const c1 = known[0] ? safeColor(context.colorOf(known[0])) : NO_PASS_COLOR;
  const c2 = known[1] ? safeColor(context.colorOf(known[1])) : c1;
  const noPass = known.length === 0;
  const raw = context.plannedDays?.[resort.id] ?? 0;
  const days = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  const properties: ResortFeatureProperties = {
    id: resort.id,
    name: resort.name,
    c1,
    c2,
    multi: known.length > 1,
    noPass,
    closed: Boolean(resort.abandoned),
    days,
    pass: passLabel(known.map((id) => context.shortNameOf(id) ?? id)),
    rank: days > 0 ? 0 : noPass ? 2 : 1,
  };
  if (kind) properties.kind = kind;
  return { type: "Feature", geometry: { type: "Point", coordinates: [resort.lon, resort.lat] }, properties };
}

export function resortFeatureCollection(resorts: ResortPoint[], context: ResortFeatureContext): ResortFeatureCollection {
  const features: ResortFeature[] = [];
  for (const resort of resorts) {
    const feature = resortFeature(resort, context);
    if (feature) features.push(feature);
  }
  return { type: "FeatureCollection", features };
}

/** Font stacks that exist on each provider's glyph server. */
export function labelFonts(provider: MapProviderId): { regular: string[]; bold: string[] } {
  if (provider === "mapbox") {
    return { regular: ["DIN Pro Medium", "Arial Unicode MS Regular"], bold: ["DIN Pro Bold", "Arial Unicode MS Bold"] };
  }
  return { regular: ["Noto Sans Regular"], bold: ["Noto Sans Bold"] };
}

interface Palette {
  ink: string;
  ink3: string;
  halo: string;
  gap: string;
  clusterFill: string;
  clusterEdge: string;
  shadow: string;
}

function palette(appearance: MapAppearance): Palette {
  return appearance === "dark"
    ? {
        ink: "#f2f4f8",
        ink3: "#aab4c5",
        halo: "#0d1320",
        gap: "#0d1320",
        clusterFill: "#1b2334",
        clusterEdge: "rgba(255, 255, 255, 0.10)",
        shadow: "#000000",
      }
    : {
        ink: "#0d1321",
        ink3: "#566072",
        halo: "#ffffff",
        gap: "#ffffff",
        clusterFill: "#ffffff",
        clusterEdge: "rgba(13, 19, 33, 0.08)",
        shadow: "#0d1321",
      };
}

type Expression = unknown[];

const isCluster: Expression = ["has", "point_count"];
const notCluster: Expression = ["!", ["has", "point_count"]];
const noPass: Expression = ["==", ["get", "noPass"], true];

/** Dot radius by zoom. Resorts without a pass are drawn a little smaller. */
function dotRadius(extra = 0): Expression {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    5,
    ["case", noPass, 3 + extra, 4.5 + extra],
    9,
    ["case", noPass, 4 + extra, 6 + extra],
    13,
    ["case", noPass, 6 + extra, 8.5 + extra],
  ];
}

const clusterRadius: Expression = ["step", ["get", "point_count"], 15, 10, 18, 30, 22];

export interface ResortLayerOptions {
  provider: MapProviderId;
  appearance: MapAppearance;
}

/** Layer specs, bottom to top. Plain objects so both map libraries accept them. */
export function resortLayerSpecs(options: ResortLayerOptions): Array<Record<string, unknown>> {
  const p = palette(options.appearance);
  const fonts = labelFonts(options.provider);
  const closedOpacity: Expression = ["case", ["==", ["get", "closed"], true], 0.45, 1];
  const nameAndPass: Expression = [
    "case",
    ["==", ["get", "pass"], ""],
    ["get", "name"],
    ["format", ["get", "name"], {}, "\n", {}, ["get", "pass"], { "font-scale": 0.84, "text-font": ["literal", fonts.regular], "text-color": p.ink3 }],
  ];
  const labelLayout = {
    "text-font": fonts.bold,
    "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 12, 13],
    "text-variable-anchor": ["left", "right", "top", "bottom"],
    "text-radial-offset": 0.9,
    "text-justify": "auto",
    "text-max-width": 9,
    "text-padding": 3,
    "symbol-sort-key": ["get", "rank"],
  };
  const labelPaint = {
    "text-color": p.ink,
    "text-halo-color": p.halo,
    "text-halo-width": 1.5,
    "text-halo-blur": 0.25,
    "text-opacity": closedOpacity,
  };
  return [
    {
      id: RESORT_LAYERS.clusterShadow,
      type: "circle",
      source: RESORT_SOURCE,
      filter: isCluster,
      paint: {
        "circle-radius": ["+", clusterRadius, 3],
        "circle-color": p.shadow,
        "circle-opacity": options.appearance === "dark" ? 0.45 : 0.16,
        "circle-blur": 0.7,
        "circle-translate": [0, 2],
      },
    },
    {
      id: RESORT_LAYERS.cluster,
      type: "circle",
      source: RESORT_SOURCE,
      filter: isCluster,
      paint: {
        "circle-radius": clusterRadius,
        "circle-color": p.clusterFill,
        "circle-stroke-width": 1,
        "circle-stroke-color": p.clusterEdge,
      },
    },
    {
      id: RESORT_LAYERS.clusterCount,
      type: "symbol",
      source: RESORT_SOURCE,
      filter: isCluster,
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": fonts.bold,
        "text-size": 13,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": p.ink },
    },
    {
      id: RESORT_LAYERS.ring,
      type: "circle",
      source: RESORT_SOURCE,
      filter: ["all", notCluster, ["==", ["get", "multi"], true]],
      paint: {
        "circle-radius": dotRadius(3),
        "circle-color": ["get", "c2"],
        "circle-opacity": closedOpacity,
      },
    },
    {
      id: RESORT_LAYERS.dot,
      type: "circle",
      source: RESORT_SOURCE,
      filter: notCluster,
      paint: {
        "circle-radius": dotRadius(),
        "circle-color": ["get", "c1"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": p.gap,
        "circle-opacity": closedOpacity,
        "circle-stroke-opacity": closedOpacity,
      },
    },
    {
      id: RESORT_LAYERS.planned,
      type: "circle",
      source: RESORT_SOURCE,
      filter: ["all", notCluster, [">", ["get", "days"], 0]],
      paint: {
        "circle-radius": dotRadius(6),
        "circle-opacity": 0,
        "circle-stroke-width": 2,
        "circle-stroke-color": p.ink,
      },
    },
    {
      id: RESORT_LAYERS.label,
      type: "symbol",
      source: RESORT_SOURCE,
      filter: ["all", notCluster, ["!", noPass]],
      minzoom: 7.2,
      layout: {
        ...labelLayout,
        "text-field": ["step", ["zoom"], ["get", "name"], 9.5, nameAndPass],
      },
      paint: labelPaint,
    },
    {
      id: RESORT_LAYERS.labelNoPass,
      type: "symbol",
      source: RESORT_SOURCE,
      filter: ["all", notCluster, noPass],
      minzoom: 10,
      layout: { ...labelLayout, "text-field": ["get", "name"] },
      paint: { ...labelPaint, "text-color": p.ink3 },
    },
    {
      id: RESORT_LAYERS.focusGlow,
      type: "circle",
      source: FOCUS_SOURCE,
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "selected"], 22, 14],
        "circle-color": ["get", "c1"],
        "circle-opacity": 0.22,
        "circle-blur": 0.4,
      },
    },
    {
      id: RESORT_LAYERS.focusRing,
      type: "circle",
      source: FOCUS_SOURCE,
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "selected"], 13, 10],
        "circle-color": p.ink,
      },
    },
    {
      id: RESORT_LAYERS.focusDot,
      type: "circle",
      source: FOCUS_SOURCE,
      paint: {
        "circle-radius": ["case", ["==", ["get", "kind"], "selected"], 9, 7],
        "circle-color": ["get", "c1"],
        "circle-stroke-width": 2.5,
        "circle-stroke-color": p.gap,
      },
    },
    {
      id: RESORT_LAYERS.focusLabel,
      type: "symbol",
      source: FOCUS_SOURCE,
      filter: ["==", ["get", "kind"], "selected"],
      layout: {
        "text-field": ["get", "name"],
        "text-font": fonts.bold,
        "text-size": 14,
        "text-anchor": "top",
        "text-offset": [0, 1.3],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
        "text-max-width": 12,
      },
      paint: { "text-color": p.ink, "text-halo-color": p.halo, "text-halo-width": 2, "text-halo-blur": 0.25 },
    },
  ];
}
