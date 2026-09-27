import { readFileSync, writeFileSync } from "node:fs";
import { portalMarkersIn } from "../src/lib/portals";
import { ImportError, importAustria } from "../src/lib/import-austria";
import publish from "../config/publish.json";

const root = new URL("..", import.meta.url);

function readText(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

function readChecked(path: string): unknown {
  const text = readText(path);
  const markers = portalMarkersIn(text);
  if (markers.length > 0) {
    throw new ImportError(`${path} contains aggregator domains: ${markers.join(", ")}`);
  }
  return JSON.parse(text);
}

try {
  const catalog = importAustria({
    passes: readChecked("imports/austria/passes.json"),
    resorts: readChecked("imports/austria/resorts.json"),
    legacyResorts: readChecked("imports/austria/legacy-resorts.json"),
    includeRestrictedPasses: publish.includeRestrictedPasses,
  });
  writeFileSync(new URL("data/passes.json", root), `${JSON.stringify(catalog.passes, null, 2)}\n`);
  writeFileSync(new URL("data/resorts.json", root), `${JSON.stringify(catalog.resorts, null, 2)}\n`);
  writeFileSync(new URL("data/osm.json", root), `${JSON.stringify(catalog.osm, null, 2)}\n`);
  writeFileSync(new URL("imports/austria/last-import-stats.json", root), `${JSON.stringify(catalog.stats, null, 2)}\n`);
  console.log(JSON.stringify(catalog.stats, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
