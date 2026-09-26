import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resorts } from "./data";

const pisteDir = join(process.cwd(), "public", "pistes");

describe("piste coverage", () => {
  it("gives every map resort a piste file or an explicit empty entry", () => {
    const files = new Set(
      readdirSync(pisteDir)
        .filter((name) => name.endsWith(".geojson"))
        .map((name) => name.slice(0, -".geojson".length)),
    );
    const none = JSON.parse(readFileSync(join(pisteDir, "none.json"), "utf8")) as unknown;
    expect(Array.isArray(none)).toBe(true);
    const empty = none as string[];
    expect(new Set(empty).size).toBe(empty.length);
    const emptySet = new Set(empty);
    const ids = resorts.map((resort) => resort.id);

    for (const id of ids) {
      const hasFile = files.has(id);
      const listedEmpty = emptySet.has(id);
      expect(hasFile !== listedEmpty, id).toBe(true);
    }
    for (const file of files) expect(ids, file).toContain(file);
    for (const id of empty) expect(ids, id).toContain(id);

    const samples = ["osm-relation-15961562", "osm-relation-3506940", "osm-way-335623048"];
    for (const id of samples) {
      const collection = JSON.parse(readFileSync(join(pisteDir, `${id}.geojson`), "utf8")) as {
        type?: string;
        features?: Array<{ properties?: { kind?: string; osm?: string } }>;
      };
      expect(collection.type).toBe("FeatureCollection");
      expect(collection.features?.length ?? 0).toBeGreaterThan(0);
      expect(collection.features?.some((feature) => feature.properties?.kind === "piste" || feature.properties?.kind === "lift")).toBe(true);
      expect(collection.features?.every((feature) => typeof feature.properties?.osm === "string" && feature.properties.osm.includes("/"))).toBe(true);
    }
    expect(readFileSync(join(pisteDir, "LICENSE.txt"), "utf8")).toMatch(/ODbL/);
  });
});
