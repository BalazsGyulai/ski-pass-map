import { describe, expect, it } from "vitest";
import { OSM_TILE_ATTRIBUTION, OSM_TILE_URL } from "./basemap";

describe("basemap tiles", () => {
  it("uses the public OpenStreetMap raster endpoint and not a keyed provider", () => {
    expect(OSM_TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(OSM_TILE_URL).not.toMatch(/carto|apikey|api_key/i);
    expect(OSM_TILE_ATTRIBUTION).toMatch(/openstreetmap\.org\/copyright/);
    expect(OSM_TILE_ATTRIBUTION).toMatch(/openskimap\.org/);
    expect(OSM_TILE_ATTRIBUTION).not.toMatch(/carto/i);
  });
});
