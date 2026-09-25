import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import osmFile from "../../data/osm.json";
import passesFile from "../../data/passes.json";
import resortsFile from "../../data/resorts.json";
import { portalMarkersIn } from "./portals";
import { catalogSchema } from "./schema";

const roots = ["data", "public"];

function jsonFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      found.push(...jsonFiles(path));
      continue;
    }
    if (/\.(json|geojson)$/.test(name)) found.push(path);
  }
  return found;
}

describe("data rights", () => {
  it("rejects skiresort, bergfex, and similar portal hosts in data files", () => {
    const hits: { file: string; markers: string[] }[] = [];
    for (const file of roots.flatMap((dir) => jsonFiles(dir))) {
      const markers = portalMarkersIn(readFileSync(file, "utf8"));
      if (markers.length > 0) hits.push({ file, markers });
    }
    expect(hits).toEqual([]);
  });

  it("validates passes, resorts, and OpenStreetMap files as one catalog", () => {
    const parsed = catalogSchema.safeParse({ passes: passesFile, resorts: resortsFile, osm: osmFile });
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.issues.slice(0, 8), null, 2));
    }
    expect(parsed.data.osm.licence).toBe("ODbL-1.0");
    expect(parsed.data.resorts.resorts).toHaveLength(parsed.data.osm.resorts.length);
    const hidden = parsed.data.resorts.resorts.filter((resort) => resort.verification === "unverified");
    expect(hidden.length).toBeGreaterThan(0);
    for (const resort of hidden) {
      expect(resort.dayTicket).toBeNull();
    }
  });
});
