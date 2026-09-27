import type { PortalStore } from "@/lib/db/portal-store";
import { resortNameForId } from "./resort-domains";
import { emptyOverrides, type OverridesPayload, type PromoPublic } from "./overrides";
import type { ResortAttribution } from "./attribution";
import type { ListingMode } from "./listing";

export async function buildOverridesPayload(portal: PortalStore): Promise<OverridesPayload> {
  const base = emptyOverrides();
  const rows = await portal.listRuntimeOverrides();
  for (const row of rows) {
    base.fields[row.resort_id] = JSON.parse(row.fields_json) as Record<string, unknown>;
    base.attributions[row.resort_id] = JSON.parse(row.attribution_json) as ResortAttribution;
  }
  const promos = await portal.listPromos("approved");
  base.promos = promos.map((p) => ({
    resortId: p.resort_id,
    text: p.text,
    linkUrl: p.link_url,
    logoUrl: p.logo_url,
    resortName: resortNameForId(p.resort_id),
  })) satisfies PromoPublic[];
  const listing = await portal.listListingModes();
  for (const row of listing) {
    base.listing[row.resort_id] = row.mode as ListingMode;
  }
  base.generatedAt = new Date().toISOString();
  return base;
}
