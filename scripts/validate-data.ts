import { readFileSync } from "node:fs";
import { datasetSchema } from "../src/lib/schema";

const dataPath = new URL("../data/resorts.json", import.meta.url);
const sitePath = new URL("../config/site.json", import.meta.url);
const raw = JSON.parse(readFileSync(dataPath, "utf8"));
const result = datasetSchema.safeParse(raw);

if (!result.success) {
  console.error(result.error.format());
  process.exit(1);
}

const site = JSON.parse(readFileSync(sitePath, "utf8")) as { basePath: string };
const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
if (!sw.includes(site.basePath) || !manifest.includes(site.basePath)) {
  console.error(`basePath ${site.basePath} is missing from public/sw.js or public/manifest.webmanifest`);
  process.exit(1);
}

const data = result.data;
console.log(`OK: ${data.resorts.length} resorts, ${data.passes.length} passes, ${data.cities.length} cities`);
