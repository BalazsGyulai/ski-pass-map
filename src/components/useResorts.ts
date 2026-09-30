import { useMemo } from "react";
import { inBounds } from "@/lib/bounds";
import { passes, resorts } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { filterResorts, sortResorts, type ResortFilters } from "@/lib/filter";
import { filterResortsForListing } from "@/lib/portal/overrides";
import { normalizeListingMode } from "@/lib/portal/listing";
import { resolveForViewer } from "@/lib/pricing";
import type { Resort } from "@/lib/schema";
import { useRuntimeOverrides } from "@/lib/runtime-overrides-client";
import { useApp } from "./AppState";

export function useResortLists() {
  const { share, favourites, home, areaBounds, birthYear, effectiveDate } = useApp();
  const overrides = useRuntimeOverrides();
  const passNames = useMemo(() => new Map(passes.map((pass) => [pass.id, pass.name])), []);
  // The viewer's price per pass (adult until a birth year is set), for the pass-price filter.
  const passPrices = useMemo(() => {
    const prices = new Map<string, number | null>();
    if (!effectiveDate) return prices;
    for (const pass of passes) prices.set(pass.id, resolveForViewer(pass, birthYear, effectiveDate).amountEur);
    return prices;
  }, [birthYear, effectiveDate]);
  const context = useMemo(
    () => ({ home, favourites: new Set(favourites), passNames, passPriceOf: (id: string) => passPrices.get(id) ?? null }),
    [home, favourites, passNames, passPrices],
  );
  const visibleResorts = useMemo(() => {
    const staticListing = Object.fromEntries(resorts.map((r) => [r.id, normalizeListingMode(r.listing)]));
    return filterResortsForListing(resorts, overrides?.listing ?? {}, staticListing);
  }, [overrides]);
  const filtered = useMemo(() => filterResorts(visibleResorts, share, context), [visibleResorts, share, context]);
  const inArea = useMemo(
    () => (areaBounds ? filtered.filter((resort) => inBounds(resort, areaBounds)) : filtered),
    [filtered, areaBounds],
  );
  const distanceOf = useMemo(() => (resort: Resort) => (home ? distanceKm(home, resort) : null), [home]);
  const sorted = useMemo(() => sortResorts(inArea, share.sort, share.dir, distanceOf), [inArea, share.sort, share.dir, distanceOf]);
  const sortedAll = useMemo(() => sortResorts(filtered, share.sort, share.dir, distanceOf), [filtered, share.sort, share.dir, distanceOf]);
  const relaxed = useMemo(() => {
    if (filtered.length > 0) return [];
    const loose: ResortFilters = {
      ...share,
      q: "",
      passes: [],
      noPass: false,
      regions: [],
      transit: false,
      park: false,
      night: false,
      minElev: null,
      minSlope: null,
      maxKm: null,
      favouritesOnly: false,
      minPassPrice: null,
      maxPassPrice: null,
    };
    return sortResorts(filterResorts(visibleResorts, loose, context), "distance", "asc", distanceOf).slice(0, 3);
  }, [filtered.length, share, context, distanceOf, visibleResorts]);
  return { filtered, sorted, sortedAll, relaxed, total: resorts.length };
}
