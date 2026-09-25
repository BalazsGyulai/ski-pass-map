import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { portalMarkersIn } from "../src/lib/portals";
import { catalogSchema } from "../src/lib/schema";
import site from "../config/site.json";

const root = new URL("..", import.meta.url);
const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

const result = catalogSchema.safeParse({
  passes: readJson("data/passes.json"),
  resorts: readJson("data/resorts.json"),
  osm: readJson("data/osm.json"),
});

if (!result.success) {
  console.error(result.error.format());
  process.exit(1);
}

const sw = readFileSync(new URL("public/sw.js", root), "utf8");
const manifest = readFileSync(new URL("public/manifest.webmanifest", root), "utf8");
if (!sw.includes(site.basePath) || !manifest.includes(site.basePath)) {
  console.error(`basePath ${site.basePath} is missing from public/sw.js or public/manifest.webmanifest`);
  process.exit(1);
}
if (!manifest.includes(site.name)) {
  console.error(`Site name ${site.name} is missing from public/manifest.webmanifest`);
  process.exit(1);
}

const hits = portalHits(new URL("data", root), new URL("public", root));
if (hits.length > 0) {
  console.error("Portal URLs are not allowed in data files:");
  for (const hit of hits) console.error(`  ${hit.file}: ${hit.markers.join(", ")}`);
  process.exit(1);
}

const data = result.data;
const unverified = data.resorts.resorts.filter((resort) => resort.verification === "unverified").length;
console.log(
  `OK: ${data.resorts.resorts.length} resorts (${unverified} unverified), ${data.passes.passes.length} passes, ${data.osm.places.length} places`,
);

function portalHits(...roots: URL[]): { file: string; markers: string[] }[] {
  const found: { file: string; markers: string[] }[] = [];
  for (const base of roots) walk(base.pathname, found);
  return found;
}

function walk(dir: string, found: { file: string; markers: string[] }[]) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, found);
      continue;
    }
    if (!/\.(json|geojson)$/.test(name)) continue;
    const markers = portalMarkersIn(readFileSync(path, "utf8"));
    if (markers.length > 0) found.push({ file: path, markers });
  }
}
