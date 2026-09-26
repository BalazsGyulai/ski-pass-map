import type { Resort } from "@/lib/schema";
import type { ListingMode } from "./listing";
import { normalizeListingMode } from "./listing";
import type { ResortAttribution } from "./attribution";

export interface PromoPublic {
  resortId: string;
  text: string;
  linkUrl: string | null;
  logoUrl: string | null;
  resortName: string;
}

export interface OverridesPayload {
  generatedAt: string;
  fields: Record<string, Record<string, unknown>>;
  attributions: Record<string, ResortAttribution>;
  promos: PromoPublic[];
  listing: Record<string, ListingMode>;
}

export function emptyOverrides(): OverridesPayload {
  return { generatedAt: new Date().toISOString(), fields: {}, attributions: {}, promos: [], listing: {} };
}

export function mergeResortWithOverrides(
  resort: Resort,
  resortId: string,
  payload: OverridesPayload | null,
): Resort & { portalAttribution?: ResortAttribution; portalPromo?: PromoPublic; linkOnly?: boolean } {
  const listingMode = normalizeListingMode(payload?.listing?.[resortId]);
  const linkOnly = listingMode === "link_only";
  const fields = payload?.fields?.[resortId];
  let next: Resort = { ...resort };
  if (fields) {
    if (typeof fields.season_dates === "string") next = { ...next, season_dates: fields.season_dates };
    if (typeof fields.snow_report === "string") next = { ...next, snow_report: fields.snow_report };
    if (typeof fields.website === "string") next = { ...next, website: fields.website };
    if (typeof fields.lifts === "number") next = { ...next, lifts: fields.lifts, lifts_display: fields.lifts };
    if (typeof fields.slope_km === "number") next = { ...next, slope_km: fields.slope_km, slope_km_display: fields.slope_km };
  }
  if (linkOnly) {
    next = {
      ...next,
      day_ticket_eur: null,
      day_ticket_season: null,
      day_ticket_dynamic: false,
      day_ticket_network_note: null,
      top_elevation_m: null,
      base_elevation_m: null,
      slope_km: null,
      lifts: null,
      slope_km_display: null,
      lifts_display: null,
      snowpark: null,
      night_skiing: null,
      season_dates: null,
      snow_report: null,
      webcam: null,
      notes: null,
      passes: [],
    };
  }
  const attribution = payload?.attributions?.[resortId];
  const promo = payload?.promos.find((p) => p.resortId === resortId);
  return { ...next, portalAttribution: attribution, portalPromo: promo, linkOnly };
}

export function filterResortsForListing<T extends { id: string }>(
  resorts: T[],
  listing: Record<string, ListingMode>,
  staticListing: Record<string, ListingMode>,
): T[] {
  return resorts.filter((r) => {
    const mode = normalizeListingMode(listing[r.id] ?? staticListing[r.id]);
    return mode !== "unlisted";
  });
}
