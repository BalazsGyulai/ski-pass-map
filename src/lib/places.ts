import cities from "../../config/reference-cities.json";
import { fold } from "./filter";

export interface ReferenceCity {
  id: string;
  name: string;
  aliases: string[];
  lat: number;
  lon: number;
  country: string;
}

export interface SavedPlace {
  id: string;
  label: string;
  lat: number;
  lon: number;
  kind: "city" | "geo";
}

export const REFERENCE_CITIES: ReferenceCity[] = cities;

const MAX_PLACES = 12;

/** Cities whose name or alias appears in the typed text. Matching stays on the device. */
export function matchReferenceCities(query: string): ReferenceCity[] {
  const text = fold(query.trim());
  if (text.length < 2) return [];
  return REFERENCE_CITIES.filter((city) => {
    const names = [city.name, ...city.aliases].map((name) => fold(name));
    return names.some((name) => name.includes(text) || (name.length >= 4 && text.includes(name)));
  }).slice(0, 6);
}

export function cityPlaceId(cityId: string): string {
  return `city:${cityId}`;
}

/** Drop anything that is not a finite place the user saved in this browser. */
export function sanitizePlaces(value: unknown): SavedPlace[] {
  if (!Array.isArray(value)) return [];
  const places: SavedPlace[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" && /^[a-z0-9:-]{1,80}$/i.test(record.id) ? record.id : null;
    const label = typeof record.label === "string" ? record.label.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 80) : "";
    const lat = typeof record.lat === "number" ? record.lat : Number.NaN;
    const lon = typeof record.lon === "number" ? record.lon : Number.NaN;
    if (!id || !label || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    places.push({ id, label, lat, lon, kind: record.kind === "geo" ? "geo" : "city" });
    if (places.length >= MAX_PLACES) break;
  }
  return places;
}

export function sanitizeActivePlaceId(value: unknown, places: SavedPlace[]): string | null {
  if (typeof value !== "string") return null;
  return places.some((place) => place.id === value) ? value : null;
}
