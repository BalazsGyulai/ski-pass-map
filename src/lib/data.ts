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

function joinResort(record: (typeof catalog.resorts.resorts)[number]): Resort {
  const osm = osmById.get(record.id);
  if (!osm) throw new Error(`Missing OpenStreetMap record for ${record.id}`);
  const snowpark = record.snowpark?.value === true || osm.snowpark === true ? true : null;
  const night = record.nightSkiing?.value === true || osm.nightSkiing === true ? true : null;
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
    slope_km: osm.slopeKm,
    lifts: osm.lifts,
    snowpark,
    night_skiing: night,
    public_transport: record.publicTransport,
    season_dates: record.seasonDates?.value ?? null,
    notes: record.notes,
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

export const passById = new Map(passes.map((pass) => [pass.id, pass]));
export const resortById = new Map(resorts.map((resort) => [resort.id, resort]));
