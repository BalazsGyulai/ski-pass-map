import { describe, expect, it } from "vitest";
import { MAPBOX_STYLE_LIGHT, OPENFREEMAP_STYLE_LIGHT, OPENSKIMAP_ATTRIBUTION, styleFor } from "./basemap";

describe("vector basemap", () => {
  it("uses OpenFreeMap Positron and Mapbox light without a token in the style URL", () => {
    expect(OPENFREEMAP_STYLE_LIGHT).toBe("https://tiles.openfreemap.org/styles/positron");
    expect(MAPBOX_STYLE_LIGHT).toBe("mapbox://styles/mapbox/light-v11");
    expect(OPENFREEMAP_STYLE_LIGHT).not.toMatch(/pk\.|access_token|apikey/i);
    expect(MAPBOX_STYLE_LIGHT).not.toMatch(/pk\.|access_token|apikey/i);
    expect(styleFor("openfreemap", "light")).toBe(OPENFREEMAP_STYLE_LIGHT);
    expect(styleFor("mapbox", "dark")).toBe("mapbox://styles/mapbox/dark-v11");
    expect(OPENSKIMAP_ATTRIBUTION).toMatch(/openskimap\.org/);
    expect(OPENSKIMAP_ATTRIBUTION).toMatch(/openstreetmap\.org\/copyright/);
  });
});
