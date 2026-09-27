import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import passesFile from "../../data/passes.json";
import resortsFile from "../../data/resorts.json";
import osmFile from "../../data/osm.json";
import publish from "../../config/publish.json";
import { ImportError, importAustria, mostlyOutside } from "./import-austria";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("importAustria", () => {
  it("reimports the committed Austria catalog", () => {
    const catalog = importAustria({
      passes: read("imports/austria/passes.json"),
      resorts: read("imports/austria/resorts.json"),
      legacyResorts: read("imports/austria/legacy-resorts.json"),
      includeRestrictedPasses: publish.includeRestrictedPasses,
    });
    expect(catalog.passes).toEqual(passesFile);
    expect(catalog.resorts).toEqual(resortsFile);
    expect(catalog.osm).toEqual(osmFile);
    expect(catalog.stats.passesExcluded).toEqual(["steiermark-joker", "wildpass-saisonkarte-winter"]);
    expect(catalog.stats.shown).toBeGreaterThan(250);
    expect(catalog.stats.hidden.unnamed).toBeGreaterThan(0);
    expect(catalog.stats.hidden["grass-ski"]).toBe(1);
    expect(catalog.stats.hidden["sub-feature"]).toBe(1);
  });

  it("rejects an aggregator source URL", () => {
    const passes = read("imports/austria/passes.json");
    passes.passes[0].officialUrl.sourceUrl = "https://www.snow-forecast.com/resorts/example";
    expect(() =>
      importAustria({
        passes,
        resorts: read("imports/austria/resorts.json"),
        legacyResorts: read("imports/austria/legacy-resorts.json"),
        includeRestrictedPasses: false,
      }),
    ).toThrow(ImportError);
  });

  it("keeps a cross-border area that has an Austrian website", () => {
    expect(
      mostlyOutside({
        rawId: "osm:way/1",
        flags: ["verify country: no Austrian locality"],
        osm: { centroid: { lat: 47, lon: 10 }, baseElevationM: null, topElevationM: null, liftCount: 1, downhillPisteKm: 1, countries: ["AT", "DE"], placesAT_withLocality: 0, websites: ["https://www.example.at/"] },
        official: {},
      }),
    ).toBe(false);
  });
});
