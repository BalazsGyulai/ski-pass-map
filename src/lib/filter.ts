import { distanceKm, type LatLon } from "./distance";
import type { Resort } from "./schema";

export type SortKey = "distance" | "day" | "elevation" | "slope" | "name";
export type SortDir = "asc" | "desc";

export interface ResortFilters {
  q: string;
  passes: string[];
  passMatch: "any" | "all";
  noPass: boolean;
  regions: string[];
  klima: boolean;
  park: boolean;
  night: boolean;
  minElev: number | null;
  minSlope: number | null;
  maxKm: number | null;
  favouritesOnly: boolean;
  showClosed: boolean;
}

export function countActiveFilters(filters: ResortFilters): number {
  let count = 0;
  if (filters.q.trim()) count += 1;
  if (filters.passes.length > 0) count += 1;
  if (filters.noPass) count += 1;
  if (filters.regions.length > 0) count += 1;
  if (filters.klima) count += 1;
  if (filters.park) count += 1;
  if (filters.night) count += 1;
  if (filters.minElev != null) count += 1;
  if (filters.minSlope != null) count += 1;
  if (filters.maxKm != null) count += 1;
  if (filters.favouritesOnly) count += 1;
  if (filters.showClosed) count += 1;
  return count;
}

export function filterResorts(
  resorts: Resort[],
  filters: ResortFilters,
  context: { home: LatLon | null; favourites: ReadonlySet<string>; passNames: ReadonlyMap<string, string> },
): Resort[] {
  const query = fold(filters.q.trim());
  return resorts.filter((resort) => {
    if (resort.status === "closed?" && !filters.showClosed) {
      const named = query.length > 0 && fold(resort.name).includes(query);
      if (!named) return false;
    }
    if (query) {
      const passText = resort.passes.map((id) => context.passNames.get(id) ?? id).join(" ");
      const haystack = fold(`${resort.name} ${resort.region} ${passText}`);
      if (!haystack.includes(query)) return false;
    }
    if (filters.noPass) {
      if (resort.passes.length > 0) return false;
    } else if (filters.passes.length > 0) {
      const selected = filters.passes;
      const hit =
        filters.passMatch === "all"
          ? selected.every((id) => resort.passes.includes(id))
          : selected.some((id) => resort.passes.includes(id));
      if (!hit) return false;
    }
    if (filters.regions.length > 0 && !filters.regions.includes(resort.region)) return false;
    if (filters.klima && !resort.klimaticket) return false;
    if (filters.park && resort.snowpark !== true) return false;
    if (filters.night && resort.night_skiing !== true) return false;
    if (filters.minElev != null && (resort.top_elevation_m == null || resort.top_elevation_m < filters.minElev)) return false;
    if (filters.minSlope != null && (resort.slope_km == null || resort.slope_km < filters.minSlope)) return false;
    if (filters.maxKm != null) {
      if (!context.home) return false;
      if (distanceKm(context.home, resort) > filters.maxKm) return false;
    }
    if (filters.favouritesOnly && !context.favourites.has(resort.id)) return false;
    return true;
  });
}

export function sortResorts(
  resorts: Resort[],
  sort: SortKey,
  dir: SortDir,
  distanceOf: (resort: Resort) => number | null,
): Resort[] {
  const sign = dir === "asc" ? 1 : -1;
  const copy = [...resorts];
  copy.sort((a, b) => {
    const primary = compareSort(a, b, sort, sign, distanceOf);
    if (primary !== 0) return primary;
    return a.name.localeCompare(b.name, "de");
  });
  return copy;
}

function compareSort(a: Resort, b: Resort, sort: SortKey, sign: number, distanceOf: (resort: Resort) => number | null): number {
  if (sort === "name") return a.name.localeCompare(b.name, "de") * sign;
  const av = sortValue(a, sort, distanceOf);
  const bv = sortValue(b, sort, distanceOf);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  return (av - bv) * sign;
}

function sortValue(resort: Resort, sort: SortKey, distanceOf: (resort: Resort) => number | null): number | null {
  if (sort === "distance") return distanceOf(resort);
  if (sort === "day") return resort.day_ticket_eur;
  if (sort === "elevation") return resort.top_elevation_m;
  if (sort === "slope") return resort.slope_km;
  return null;
}

export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
