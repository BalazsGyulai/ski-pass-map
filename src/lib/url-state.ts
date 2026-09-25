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
  showPistes: boolean;
}

export function defaultShareState(): ShareState {
  return {
    q: "",
    passes: [],
    passMatch: "any",
    noPass: false,
    regions: [],
    transit: false,
    park: false,
    night: false,
    minElev: null,
    minSlope: null,
    maxKm: null,
    favouritesOnly: false,
    showAbandoned: false,
    home: "",
    geoLat: null,
    geoLon: null,
    resort: null,
    view: "map",
    lang: "en",
    sort: "distance",
    dir: "asc",
    showPistes: false,
  };
}

export function parseShareState(params: URLSearchParams): ShareState {
  const state = defaultShareState();
  state.q = cleanText(params.get("q") ?? "", 200);
  state.passes = idList(params.get("passes"), ",", 24);
  const match = params.get("match");
  state.passMatch = match === "all" ? "all" : "any";
  state.noPass = params.get("nopass") === "1";
  state.regions = labelList(params.get("regions"), "|", 24);
  state.transit = params.get("transit") === "1" || params.get("klima") === "1";
  state.park = params.get("park") === "1";
  state.night = params.get("night") === "1";
  state.minElev = positiveOrNull(params.get("minElev"));
  state.minSlope = positiveOrNull(params.get("minSlope"));
  state.maxKm = positiveOrNull(params.get("maxKm"));
  state.favouritesOnly = params.get("fav") === "1";
  state.showAbandoned = params.get("abandoned") === "1" || params.get("closed") === "1";
  const home = params.get("home");
  // "geo" is a device location. It is never read from a shared URL.
  state.home = home && home !== "geo" ? (safeId(home, 64) ?? "") : "";
  state.geoLat = null;
  state.geoLon = null;
  state.resort = safeId(params.get("resort"), 80);
  const view = params.get("view");
  state.view = view === "list" || view === "filters" ? view : "map";
  state.lang = params.get("lang") === "hu" ? "hu" : "en";
  const sort = params.get("sort");
  state.sort = sort === "day" || sort === "elevation" || sort === "slope" || sort === "name" ? sort : "distance";
  state.dir = params.get("dir") === "desc" ? "desc" : "asc";
  state.showPistes = params.get("pistes") === "1";
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
  if (state.transit) params.set("transit", "1");
  if (state.park) params.set("park", "1");
  if (state.night) params.set("night", "1");
  if (state.minElev != null) params.set("minElev", String(state.minElev));
  if (state.minSlope != null) params.set("minSlope", String(state.minSlope));
  if (state.maxKm != null) params.set("maxKm", String(state.maxKm));
  if (state.favouritesOnly) params.set("fav", "1");
  if (state.showAbandoned) params.set("abandoned", "1");
  if (state.home && state.home !== "geo" && state.home !== defaults.home) params.set("home", state.home);
  if (state.resort) params.set("resort", state.resort);
  if (state.view !== "map") params.set("view", state.view);
  if (state.lang !== "en") params.set("lang", state.lang);
  if (state.sort !== "distance") params.set("sort", state.sort);
  if (state.dir !== "asc") params.set("dir", state.dir);
  if (state.showPistes) params.set("pistes", "1");
  return params.toString();
}

function labelList(value: string | null, separator: string, maxItems: number): string[] {
  if (!value) return [];
  const labels: string[] = [];
  for (const part of value.split(separator)) {
    const label = part.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80);
    if (!label || !/^[A-Za-z][A-Za-z -]*$/.test(label) || labels.includes(label)) continue;
    labels.push(label);
    if (labels.length >= maxItems) break;
  }
  return labels;
}

function idList(value: string | null, separator: string, maxItems: number): string[] {
  if (!value) return [];
  const ids: string[] = [];
  for (const part of value.split(separator)) {
    const id = safeId(part.trim(), 64);
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= maxItems) break;
  }
  return ids;
}

function safeId(value: string | null, max: number): string | null {
  if (!value) return null;
  const id = value.trim();
  if (id.length < 1 || id.length > max) return null;
  return /^[a-z0-9-]+$/i.test(id) ? id : null;
}

function cleanText(value: string, max: number): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max);
}

/** Query string safe to put in the address bar or a copied link. Device coordinates are removed. */
export function shareableSearch(params: URLSearchParams, share?: Pick<ShareState, "home" | "lang">): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("lat");
  next.delete("lon");
  if (next.get("home") === "geo") next.delete("home");
  if (share) {
    if (share.home && share.home !== "geo") next.set("home", share.home);
    else next.delete("home");
    if (share.lang === "en") next.delete("lang");
    else next.set("lang", share.lang);
  }
  return next;
}

export function bareResortUrl(path: string, state: ShareState): string {
  const qs = serializeShareState({ ...state, resort: null, view: "map" });
  return qs ? `${path}?${qs}` : path;
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
