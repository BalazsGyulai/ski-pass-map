export type PisteDifficulty = "novice" | "easy" | "intermediate" | "advanced" | "expert" | "freeride" | "unknown";

export interface PisteProperties {
  kind: "piste" | "lift";
  difficulty: PisteDifficulty | null;
  name: string | null;
  aerialway: string | null;
  osm: string;
}

export interface PisteStyle {
  color: string;
  dashArray: string | undefined;
  weight: number;
}

const STYLES: Record<PisteDifficulty, PisteStyle> = {
  novice: { color: "#1f9d55", dashArray: undefined, weight: 3 },
  easy: { color: "#1d6fd8", dashArray: undefined, weight: 3 },
  intermediate: { color: "#d62728", dashArray: undefined, weight: 3 },
  advanced: { color: "#161616", dashArray: undefined, weight: 3.5 },
  expert: { color: "#161616", dashArray: undefined, weight: 3.5 },
  freeride: { color: "#e67e22", dashArray: "8 6", weight: 3 },
  unknown: { color: "#6b7280", dashArray: undefined, weight: 2.5 },
};

export function normalizeDifficulty(value: string | null | undefined): PisteDifficulty {
  const key = (value ?? "").toLowerCase();
  if (key === "novice" || key === "easy" || key === "intermediate" || key === "advanced" || key === "expert" || key === "freeride") {
    return key;
  }
  return "unknown";
}

export function pisteStyle(difficulty: PisteDifficulty | null, kind: "piste" | "lift"): PisteStyle {
  if (kind === "lift") return { color: "#1c2430", dashArray: undefined, weight: 2.5 };
  return STYLES[difficulty ?? "unknown"];
}

/** Douglas–Peucker in degree space. Enough for short piste segments. */
export function simplifyLine(points: number[][], epsilon: number): number[][] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const range = stack.pop();
    if (!range) break;
    const [start, end] = range;
    let max = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > max) {
        max = distance;
        index = i;
      }
    }
    if (index !== -1 && max > epsilon) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function perpendicularDistance(point: number[], start: number[], end: number[]): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
}
