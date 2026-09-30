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
  transit: boolean;
  park: boolean;
  night: boolean;
  minElev: number | null;
  minSlope: number | null;
  maxKm: number | null;
  favouritesOnly: boolean;
  showAbandoned: boolean;
  /** Keep resorts that a pass in this price band covers. Null is that end of the scale. */
  minPassPrice: number | null;
  maxPassPrice: number | null;
}

/** The pass-price slider. Either end means that limit is off. */
export const PASS_PRICE_MIN = 300;
export const PASS_PRICE_MAX = 1300;
export const PASS_PRICE_STEP = 50;

/**
 * A typed elevation or slope. Empty clears the filter. A minus, or any other
 * non-number, is refused so the field can ignore that keystroke.
 * `undefined` means "still typing a decimal" when the text ends with a dot.
 */
export function measureFromField(raw: string, integer: boolean): number | null | undefined {
  if (raw === "") return null;
  if (!(integer ? /^\d+$/ : /^\d*\.?\d*$/).test(raw)) return undefined;
  if (!integer && (raw === "." || raw.endsWith("."))) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/** Snap a typed price onto the slider scale, and keep it inside the other thumb. */
export function snapPassPrice(value: number, other: number, bound: "min" | "max"): number | null {
  if (!Number.isFinite(value)) return null;
  const stepped = Math.round(value / PASS_PRICE_STEP) * PASS_PRICE_STEP;
  const clamped = Math.min(PASS_PRICE_MAX, Math.max(PASS_PRICE_MIN, stepped));
  if (bound === "min") {
    const next = Math.min(clamped, other);
    return next <= PASS_PRICE_MIN ? null : next;
  }
  const next = Math.max(clamped, other);
  return next >= PASS_PRICE_MAX ? null : next;
}

export function countActiveFilters(filters: ResortFilters): number {
  let count = 0;
  if (filters.q.trim()) count += 1;
  if (filters.passes.length > 0) count += 1;
  if (filters.noPass) count += 1;
  if (filters.regions.length > 0) count += 1;
  if (filters.transit) count += 1;
  if (filters.park) count += 1;
  if (filters.night) count += 1;
  if (filters.minElev != null) count += 1;
  if (filters.minSlope != null) count += 1;
  if (filters.maxKm != null) count += 1;
  if (filters.favouritesOnly) count += 1;
  if (filters.showAbandoned) count += 1;
  if (filters.minPassPrice != null || filters.maxPassPrice != null) count += 1;
  return count;
}

export function filterResorts(
  resorts: Resort[],
  filters: ResortFilters,
  context: {
    home: LatLon | null;
    favourites: ReadonlySet<string>;
    passNames: ReadonlyMap<string, string>;
    /** The viewer's price for a pass. Needed for the price band. */
    passPriceOf?: (passId: string) => number | null;
  },
): Resort[] {
  const query = fold(filters.q.trim());
  return resorts.filter((resort) => {
    if (resort.abandoned && !filters.showAbandoned) {
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
    if (filters.transit && !resort.public_transport) return false;
    if (filters.park && resort.snowpark !== true) return false;
    if (filters.night && resort.night_skiing !== true) return false;
    if (filters.minElev != null && (resort.top_elevation_m == null || resort.top_elevation_m < filters.minElev)) return false;
    if (filters.minSlope != null && (resort.slope_km == null || resort.slope_km < filters.minSlope)) return false;
    if (filters.maxKm != null && context.home && distanceKm(context.home, resort) > filters.maxKm) return false;
    if (filters.favouritesOnly && !context.favourites.has(resort.id)) return false;
    if (filters.minPassPrice != null || filters.maxPassPrice != null) {
      const low = filters.minPassPrice;
      const high = filters.maxPassPrice;
      const candidates = filters.passes.length > 0 ? resort.passes.filter((id) => filters.passes.includes(id)) : resort.passes;
      const inBand = candidates.some((id) => {
        const price = context.passPriceOf?.(id);
        if (price == null) return false;
        if (low != null && price < low) return false;
        if (high != null && price > high) return false;
        return true;
      });
      if (!inBand) return false;
    }
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
