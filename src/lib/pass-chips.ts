import { inBounds, type MapBounds } from "./bounds";
import { distanceKm, type LatLon } from "./distance";

interface ChipResort {
  lat: number;
  lon: number;
  abandoned?: boolean;
  passes: string[];
}

interface ChipPass {
  id: string;
}

/**
 * Pass chips stay in one order. The map area leads when search-as-move is on, otherwise the
 * nearest resort to the reference point, otherwise the name.
 */
export function orderPassChips<T extends ChipPass>(
  passes: readonly T[],
  resorts: readonly ChipResort[],
  options: {
    searchAsMove: boolean;
    area: MapBounds | null;
    home: LatLon | null;
    name: (pass: T) => string;
  },
): T[] {
  const open = resorts.filter((resort) => !resort.abandoned);
  const byName = (a: T, b: T) => options.name(a).localeCompare(options.name(b), undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);

  if (options.searchAsMove && options.area) {
    const counts = new Map<string, number>();
    for (const resort of open) {
      if (!inBounds(resort, options.area)) continue;
      for (const id of resort.passes) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...passes].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || byName(a, b));
  }

  if (options.home) {
    const nearest = new Map<string, number>();
    for (const resort of open) {
      const distance = distanceKm(options.home, resort);
      for (const id of resort.passes) {
        const current = nearest.get(id);
        if (current == null || distance < current) nearest.set(id, distance);
      }
    }
    return [...passes].sort((a, b) => {
      const left = nearest.get(a.id);
      const right = nearest.get(b.id);
      if (left == null && right == null) return byName(a, b);
      if (left == null) return 1;
      if (right == null) return -1;
      return left - right || byName(a, b);
    });
  }

  return [...passes].sort(byName);
}
