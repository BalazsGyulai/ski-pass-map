import osmFile from "../../data/osm.json";
import passesFile from "../../data/passes.json";
import resortsFile from "../../data/resorts.json";
import { catalogSchema, type City, type Pass, type Resort } from "./schema";

const catalog = catalogSchema.parse({ passes: passesFile, resorts: resortsFile, osm: osmFile });

export const generated = catalog.resorts.generated;
export const passes: Pass[] = catalog.passes.passes;
export const cities: City[] = catalog.osm.places.map((place) => ({
  id: place.id,
  name: place.name,
  lat: place.lat,
  lon: place.lon,
  country: place.country,
}));

const osmById = new Map(catalog.osm.resorts.map((resort) => [resort.id, resort]));
export const passById = new Map(passes.map((pass) => [pass.id, pass]));

function ref(fact: { sourceUrl?: string; checkedAt?: string } | null | undefined): { sourceUrl: string | null; checkedAt: string | null } | undefined {
  if (!fact?.sourceUrl && !fact?.checkedAt) return undefined;
  return { sourceUrl: fact.sourceUrl ?? null, checkedAt: fact.checkedAt ?? null };
}

function joinResort(record: (typeof catalog.resorts.resorts)[number]): Resort {
  const osm = osmById.get(record.id);
  if (!osm) throw new Error(`Missing OpenStreetMap record for ${record.id}`);
  const snowpark = record.snowpark?.value === true || osm.snowpark === true ? true : null;
  const night = record.nightSkiing?.value === true || osm.nightSkiing === true ? true : null;
  const osmChecked = catalog.osm.generated;
  return {
    id: record.id,
    name: record.name,
    lat: osm.lat,
    lon: osm.lon,
    region: record.region,
    country: record.country,
    passes: record.passes.map((coverage) => coverage.id),
    abandoned: osm.abandoned,
    day_ticket_eur: record.dayTicket?.value.eur ?? null,
    day_ticket_season: record.dayTicket?.value.season ?? null,
    website: record.website?.value ?? null,
    top_elevation_m: osm.topElevationM,
    base_elevation_m: osm.baseElevationM,
    slope_km: osm.aggregate ? null : osm.slopeKm,
    lifts: osm.aggregate ? null : osm.lifts,
    slope_km_display: osm.slopeKm,
    lifts_display: osm.lifts,
    stats_aggregate: osm.aggregate,
    snowpark,
    night_skiing: night,
    public_transport: record.publicTransport,
    season_dates: record.seasonDates?.value ?? null,
    notes: record.notes,
    day_ticket_dynamic: record.dayTicketDynamic?.value === true,
    day_ticket_network_note: record.networkPriceNote,
    needs_recheck: record.needsRecheck,
    via_tourism_site: record.viaTourismSite,
    snow_report: record.snowReport?.value ?? null,
    webcam: record.webcam?.value ?? null,
    provisional_passes: record.passes
      .map((coverage) => coverage.id)
      .filter((id) => passById.get(id)?.provisional),
    sources: {
      dayTicket: ref(record.dayTicket),
      website: ref(record.website),
      season: ref(record.seasonDates),
      snowpark: ref(record.snowpark),
      nightSkiing: ref(record.nightSkiing),
      snowReport: ref(record.snowReport),
      webcam: ref(record.webcam),
      dynamic: ref(record.dayTicketDynamic),
      slopes: osm.slopeKm == null ? undefined : { sourceUrl: null, checkedAt: osmChecked },
      lifts: osm.lifts == null ? undefined : { sourceUrl: null, checkedAt: osmChecked },
      elevation:
        osm.topElevationM == null && osm.baseElevationM == null ? undefined : { sourceUrl: null, checkedAt: osmChecked },
    },
  };
}

const joined = catalog.resorts.resorts.map(joinResort);

/** Resorts evidenced by OpenStreetMap, an official site, or a pass list. Portal-only rows stay in the file and off the map. */
export const resorts: Resort[] = joined.filter((resort) => {
  const record = catalog.resorts.resorts.find((item) => item.id === resort.id);
  return record?.verification === "verified";
});

export const unverifiedResortIds: string[] = catalog.resorts.resorts
  .filter((resort) => resort.verification === "unverified")
  .map((resort) => resort.id);

export const resortById = new Map(resorts.map((resort) => [resort.id, resort]));
