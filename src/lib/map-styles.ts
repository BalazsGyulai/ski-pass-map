/**
 * Light, quiet vector styles that sit under the resort pills.
 * OpenFreeMap Positron includes Natural Earth shaded relief (`ne2_shaded`) at low zoom.
 * Mapbox light-v11 is the matching quiet style. Neither URL contains a token.
 */
export const OPENFREEMAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
export const OPENFREEMAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
export const MAPBOX_STYLE_LIGHT = "mapbox://styles/mapbox/light-v11";
export const MAPBOX_STYLE_DARK = "mapbox://styles/mapbox/dark-v11";

export const AUSTRIA_LNG = 13.35;
export const AUSTRIA_LAT = 47.5;

export const OPENSNOWMAP_TILES = "https://tiles.opensnowmap.org/pistes/{z}/{x}/{y}.png";
export const OPENSNOWMAP_ATTRIBUTION =
  '© <a href="https://www.opensnowmap.org/" target="_blank" rel="noopener noreferrer">OpenSnowMap.org</a> (CC BY-SA)';

/** Extra credit appended to the style's own attribution. OSM/ODbL stays visible either way. */
export const OPENSKIMAP_ATTRIBUTION =
  '<a href="https://openskimap.org/" target="_blank" rel="noopener noreferrer">OpenSkiMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">ODbL</a>';

export const MAPLIBRE_ATTRIBUTION =
  '<a href="https://maplibre.org/" target="_blank" rel="noopener noreferrer">MapLibre</a>';

export type MapAppearance = "light" | "dark";
export type MapProviderId = "mapbox" | "openfreemap";

export function styleFor(provider: MapProviderId, appearance: MapAppearance): string {
  if (provider === "mapbox") return appearance === "dark" ? MAPBOX_STYLE_DARK : MAPBOX_STYLE_LIGHT;
  return appearance === "dark" ? OPENFREEMAP_STYLE_DARK : OPENFREEMAP_STYLE_LIGHT;
}

export function mapAppearance(theme: "system" | "light" | "dark", prefersDark: boolean): MapAppearance {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return prefersDark ? "dark" : "light";
}
