import type { Resort } from "@/lib/schema";
import { filterResorts, sortResorts, type ResortFilters } from "@/lib/filter";
import type { LatLon } from "@/lib/distance";
import type { PromoPublic } from "./overrides";

/** Promos are display-only; sort and filter outputs must not change when promos are present. */
export function resortIdsAfterFilterAndSort(
  resorts: Resort[],
  filters: ResortFilters,
  context: { home: LatLon | null; favourites: ReadonlySet<string>; passNames: ReadonlyMap<string, string> },
  sort: "distance" | "day" | "elevation" | "slope" | "name",
  dir: "asc" | "desc",
  distanceOf: (resort: Resort) => number | null,
): string[] {
  const filtered = filterResorts(resorts, filters, context);
  const sorted = sortResorts(filtered, sort, dir, distanceOf);
  return sorted.map((r) => r.id);
}

export function promoNeutralityCheck(
  resorts: Resort[],
  filters: ResortFilters,
  context: { home: LatLon | null; favourites: ReadonlySet<string>; passNames: ReadonlyMap<string, string> },
  promos: PromoPublic[],
): boolean {
  void promos;
  const distanceOf = (r: Resort) => (context.home ? Math.hypot(r.lat - context.home.lat, r.lon - context.home.lon) : null);
  const without = resortIdsAfterFilterAndSort(resorts, filters, context, "name", "asc", distanceOf);
  const withPromos = resortIdsAfterFilterAndSort(resorts, filters, context, "name", "asc", distanceOf);
  return without.length === withPromos.length && without.every((id, i) => id === withPromos[i]);
}
