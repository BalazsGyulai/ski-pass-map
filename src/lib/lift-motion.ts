/**
 * Lifts move on the map: cabins, chairs and drag hangers run uphill along each lift line (OSM
 * draws lifts from the valley station up), each type at its own calm pace. The motion is a dash
 * pattern stepped through a fixed cycle, so the GPU draws it from a few cached patterns and no
 * data changes. It pauses in background tabs and when zoomed out, and never runs for visitors
 * who ask for reduced motion (the lifts then show their cabins standing still).
 */

export type LiftClass = "cabin" | "chair" | "surface" | "carpet";

export const LIFT_CLASSES: readonly LiftClass[] = ["cabin", "chair", "surface", "carpet"];

/** OSM aerialway values per class. Zip lines and untyped lifts keep the plain cable line. */
export const LIFT_TYPES: Record<LiftClass, readonly string[]> = {
  cabin: ["gondola", "cable_car", "mixed_lift"],
  chair: ["chair_lift"],
  surface: ["t-bar", "j-bar", "platter", "drag_lift", "rope_tow"],
  carpet: ["magic_carpet"],
};

export function liftClass(aerialway: string | null | undefined): LiftClass | null {
  if (!aerialway) return null;
  return LIFT_CLASSES.find((cls) => LIFT_TYPES[cls].includes(aerialway)) ?? null;
}

export interface LiftMotionStyle {
  /** Line width in pixels. Dash and gap are in line widths, as the style spec measures them. */
  width: number;
  dash: number;
  gap: number;
  /** Steps per pattern period. */
  steps: number;
  /** Advance one step every this many ticks: gondolas run faster than a magic carpet. */
  every: number;
}

export const LIFT_MOTION: Record<LiftClass, LiftMotionStyle> = {
  cabin: { width: 4.5, dash: 1.1, gap: 4.9, steps: 16, every: 1 },
  chair: { width: 3, dash: 1, gap: 4, steps: 12, every: 1 },
  surface: { width: 2, dash: 1, gap: 2.5, steps: 10, every: 1 },
  carpet: { width: 2, dash: 1, gap: 2, steps: 8, every: 2 },
};

export const LIFT_TICK_MS = 80;
/** Below this zoom the cabins would blur into the line, so they are not drawn at all. */
export const LIFT_MOTION_MINZOOM = 12;

export function liftLayerId(cls: LiftClass): string {
  return `lift-${cls}`;
}

/** The dash pattern moved `shift` along the line (0 ≤ shift < dash + gap), as a line-dasharray. */
export function shiftedDash(dash: number, gap: number, shift: number): number[] {
  const period = dash + gap;
  const s = ((shift % period) + period) % period;
  if (s === 0) return [dash, gap];
  // The dash starts inside the gap: an empty dash, the gap before it, the dash, the rest.
  if (s <= gap) return [0, round(s), dash, round(gap - s)];
  // The dash wraps past the end of the period: its tail opens the pattern.
  return [round(s - gap), gap, round(period - s), 0];
}

/** The patterns one class steps through, in order. Precomputed, so the map caches each once. */
export function dashCycle(style: LiftMotionStyle): number[][] {
  const period = style.dash + style.gap;
  return Array.from({ length: style.steps }, (_, step) => shiftedDash(style.dash, style.gap, (period * step) / style.steps));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The map surface the motion needs; both map libraries have these. */
export interface LiftMotionMap {
  getLayer(id: string): unknown;
  getZoom(): number;
  setPaintProperty(layer: string, name: string, value: unknown): void;
}

/**
 * Steps every lift layer on a timer and returns a stop function. Missing layers are skipped, so a
 * style swap in the middle is harmless: the layers come back with the pistes and move again.
 */
export function startLiftMotion(map: LiftMotionMap, env: { hidden: () => boolean } = { hidden: () => document.hidden }): () => void {
  const cycles = Object.fromEntries(LIFT_CLASSES.map((cls) => [cls, dashCycle(LIFT_MOTION[cls])])) as Record<LiftClass, number[][]>;
  let tick = 0;
  const timer = setInterval(() => {
    if (env.hidden() || map.getZoom() < LIFT_MOTION_MINZOOM) return;
    tick += 1;
    for (const cls of LIFT_CLASSES) {
      const { every } = LIFT_MOTION[cls];
      if (tick % every !== 0) continue;
      const id = liftLayerId(cls);
      if (!map.getLayer(id)) continue;
      const cycle = cycles[cls];
      map.setPaintProperty(id, "line-dasharray", cycle[(tick / every) % cycle.length]);
    }
  }, LIFT_TICK_MS);
  return () => clearInterval(timer);
}
