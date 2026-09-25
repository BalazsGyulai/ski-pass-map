import type { ResortFilters, SortDir, SortKey } from "./filter";

export type MobileView = "map" | "list" | "filters";
export type Lang = "en" | "hu";

export interface ShareState extends ResortFilters {
  home: string;
  geoLat: number | null;
  geoLon: number | null;
  resort: string | null;
  view: MobileView;
  lang: Lang;
  sort: SortKey;
  dir: SortDir;
}

export function defaultShareState(): ShareState {
  return {
    q: "",
    passes: [],
    passMatch: "any",
    noPass: false,
    regions: [],
    klima: false,
    park: false,
    night: false,
    minElev: null,
    minSlope: null,
    maxKm: null,
    favouritesOnly: false,
    home: "sopron",
    geoLat: null,
    geoLon: null,
    resort: null,
    view: "map",
    lang: "en",
    sort: "distance",
    dir: "asc",
  };
}

export function parseShareState(params: URLSearchParams): ShareState {
  const state = defaultShareState();
  state.q = params.get("q") ?? "";
  state.passes = splitList(params.get("passes"), ",");
  const match = params.get("match");
  state.passMatch = match === "all" ? "all" : "any";
  state.noPass = params.get("nopass") === "1";
  state.regions = splitList(params.get("regions"), "|");
  state.klima = params.get("klima") === "1";
  state.park = params.get("park") === "1";
  state.night = params.get("night") === "1";
  state.minElev = positiveOrNull(params.get("minElev"));
  state.minSlope = positiveOrNull(params.get("minSlope"));
  state.maxKm = positiveOrNull(params.get("maxKm"));
  state.favouritesOnly = params.get("fav") === "1";
  state.home = params.get("home") || "sopron";
  const lat = finiteOrNull(params.get("lat"));
  const lon = finiteOrNull(params.get("lon"));
  state.geoLat = lat != null && lat >= -90 && lat <= 90 ? lat : null;
  state.geoLon = lon != null && lon >= -180 && lon <= 180 ? lon : null;
  state.resort = params.get("resort") || null;
  const view = params.get("view");
  state.view = view === "list" || view === "filters" ? view : "map";
  state.lang = params.get("lang") === "hu" ? "hu" : "en";
  const sort = params.get("sort");
  state.sort = sort === "day" || sort === "elevation" || sort === "slope" || sort === "name" ? sort : "distance";
  state.dir = params.get("dir") === "desc" ? "desc" : "asc";
  return state;
}

export function serializeShareState(state: ShareState): string {
  const defaults = defaultShareState();
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.passes.length > 0) params.set("passes", state.passes.join(","));
  if (state.passMatch !== defaults.passMatch) params.set("match", state.passMatch);
  if (state.noPass) params.set("nopass", "1");
  if (state.regions.length > 0) params.set("regions", state.regions.join("|"));
  if (state.klima) params.set("klima", "1");
  if (state.park) params.set("park", "1");
  if (state.night) params.set("night", "1");
  if (state.minElev != null) params.set("minElev", String(state.minElev));
  if (state.minSlope != null) params.set("minSlope", String(state.minSlope));
  if (state.maxKm != null) params.set("maxKm", String(state.maxKm));
  if (state.favouritesOnly) params.set("fav", "1");
  if (state.home !== defaults.home) params.set("home", state.home);
  if (state.home === "geo" && state.geoLat != null && state.geoLon != null) {
    params.set("lat", state.geoLat.toFixed(5));
    params.set("lon", state.geoLon.toFixed(5));
  }
  if (state.resort) params.set("resort", state.resort);
  if (state.view !== "map") params.set("view", state.view);
  if (state.lang !== "en") params.set("lang", state.lang);
  if (state.sort !== "distance") params.set("sort", state.sort);
  if (state.dir !== "asc") params.set("dir", state.dir);
  return params.toString();
}

function splitList(value: string | null, separator: string): string[] {
  if (!value) return [];
  return value.split(separator).map((part) => part.trim()).filter(Boolean);
}

function finiteOrNull(value: string | null): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveOrNull(value: string | null): number | null {
  const number = finiteOrNull(value);
  if (number == null || number < 0) return null;
  return number;
}
