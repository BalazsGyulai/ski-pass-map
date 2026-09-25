import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { distanceKm } from "../src/lib/distance";
import { stripPortalUrls } from "../src/lib/portals";
import { normalizeDifficulty, simplifyLine } from "../src/lib/pistes";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = join(root, "data", "pistes", "raw");
const outDir = join(root, "public", "pistes");
const refresh = process.argv.includes("--refresh");
const endpoints = [
  "https://lz4.overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const userAgent = "ski-pass-map/1.0 (static educational map; caches Overpass responses; not a tile scraper)";
const delayMs = 4000;

interface ResortPoint {
  id: string;
  lat: number;
  lon: number;
  slope_km: number | null;
}

interface Draft {
  lines: number[][][];
  anchors: number[][][];
  kind: "piste" | "lift";
  difficulty: ReturnType<typeof normalizeDifficulty> | null;
  name: string | null;
  aerialway: string | null;
  osm: string;
}

const liftTypes = new Set([
  "chair_lift",
  "drag_lift",
  "gondola",
  "mixed_lift",
  "platter",
  "t-bar",
  "magic_carpet",
  "rope_tow",
  "funicular",
  "cable_car",
  "j-bar",
  "zip_line",
  "yes",
]);

const osm = JSON.parse(readFileSync(join(root, "data", "osm.json"), "utf8")) as {
  resorts: Array<{ id: string; lat: number; lon: number; slopeKm: number | null }>;
};
const resorts: ResortPoint[] = osm.resorts.map((resort) => ({
  id: resort.id,
  lat: resort.lat,
  lon: resort.lon,
  slope_km: resort.slopeKm,
}));

function radiusKm(resort: ResortPoint): number {
  const km = resort.slope_km;
  if (km == null) return 3;
  if (km >= 80) return 9;
  if (km >= 30) return 6.5;
  if (km >= 10) return 4.5;
  if (km >= 3) return 3;
  return 1.8;
}

function clusters(): ResortPoint[][] {
  const pending = [...resorts].sort((a, b) => a.lon - b.lon || a.lat - b.lat);
  const heavy = pending.filter((resort) => radiusKm(resort) >= 6.5);
  const remaining = pending.filter((resort) => radiusKm(resort) < 6.5);
  const groups: ResortPoint[][] = heavy.map((resort) => [resort]);
  while (remaining.length > 0) {
    const seed = remaining.shift();
    if (!seed) break;
    const group = [seed];
    for (let index = 0; index < remaining.length && group.length < 6; ) {
      const candidate = remaining[index];
      const near = group.some((resort) => distanceKm(resort, candidate) <= 18);
      if (near) {
        const next = remaining.splice(index, 1)[0];
        if (next) group.push(next);
      }
      else index += 1;
    }
    groups.push(group);
  }
  return groups;
}

function clausesFor(group: ResortPoint[], kind: "piste" | "relation" | "lift"): string[] {
  return group.map((resort) => {
    const radius = Math.round(radiusKm(resort) * 1000);
    const around = `(around:${radius},${resort.lat},${resort.lon})`;
    if (kind === "piste") return `way["piste:type"="downhill"]${around}`;
    if (kind === "relation") return `relation["piste:type"="downhill"]${around}`;
    return `way["aerialway"]${around}`;
  });
}

function queryFor(group: ResortPoint[], kind?: "piste" | "relation" | "lift"): string {
  const clauses = kind
    ? clausesFor(group, kind)
    : [...clausesFor(group, "piste"), ...clausesFor(group, "relation"), ...clausesFor(group, "lift")];
  return `[out:json][timeout:45];(${clauses.join(";")};);out geom;`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usablePayload(payload: { osm3s?: { timestamp_osm_base?: string }; elements?: unknown[] }): boolean {
  const stamp = payload.osm3s?.timestamp_osm_base ?? "";
  return /^\d{4}-\d{2}-\d{2}/.test(stamp) && Array.isArray(payload.elements);
}

type OverpassPayload = { elements?: Array<Record<string, unknown>>; osm3s?: { timestamp_osm_base?: string } };

let lastRequestAt = 0;

async function fetchOverpass(query: string): Promise<OverpassPayload> {
  let last = "no attempt";
  for (let round = 1; round <= 4; round++) {
    for (const endpoint of endpoints) {
      const wait = delayMs - (Date.now() - lastRequestAt);
      if (lastRequestAt > 0 && wait > 0) await sleep(wait);
      lastRequestAt = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 70_000);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": userAgent },
          body: `data=${encodeURIComponent(query)}`,
        });
        const text = await response.text();
        if (response.ok && !text.startsWith("<") && !text.startsWith("<?")) {
          const payload = JSON.parse(text) as OverpassPayload;
          if (usablePayload(payload)) return payload;
          last = `${endpoint} unusable timestamp ${payload.osm3s?.timestamp_osm_base ?? "missing"}`;
          continue;
        }
        last = `${endpoint} ${response.status} ${text.slice(0, 80).replace(/\s+/g, " ")}`;
      } catch (error) {
        last = `${endpoint} ${error instanceof Error ? error.message : "failed"}`;
      } finally {
        clearTimeout(timer);
      }
    }
    if (round < 4) {
      const pause = 8000 * round;
      console.log(`  waiting ${pause / 1000}s after ${last}`);
      await sleep(pause);
    }
  }
  throw new Error(last);
}

function mergePayloads(parts: OverpassPayload[]): OverpassPayload {
  const merged: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  let stamp: OverpassPayload["osm3s"];
  for (const payload of parts) {
    stamp = payload.osm3s ?? stamp;
    for (const element of payload.elements ?? []) {
      const id = `${element.type}/${element.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(element);
    }
  }
  return { elements: merged, osm3s: stamp };
}

async function fetchKind(group: ResortPoint[], kind: "piste" | "relation" | "lift"): Promise<OverpassPayload> {
  try {
    return await fetchOverpass(queryFor(group, kind));
  } catch (error) {
    if (group.length === 1) throw error;
    console.log(`  ${kind} failed for the batch; querying resorts separately`);
    const parts: OverpassPayload[] = [];
    for (const resort of group) parts.push(await fetchOverpass(queryFor([resort], kind)));
    return mergePayloads(parts);
  }
}

async function fetchSplit(group: ResortPoint[]): Promise<OverpassPayload> {
  const parts: OverpassPayload[] = [];
  for (const kind of ["piste", "relation", "lift"] as const) {
    console.log(`  ${kind}`);
    parts.push(await fetchKind(group, kind));
  }
  return mergePayloads(parts);
}

async function fetchGroup(group: ResortPoint[]): Promise<OverpassPayload> {
  const heavy = group.some((resort) => radiusKm(resort) >= 6.5);
  if (heavy) return fetchSplit(group);
  try {
    return await fetchOverpass(queryFor(group));
  } catch (error) {
    console.log(`  combined query failed (${error instanceof Error ? error.message : error}); splitting`);
    return fetchSplit(group);
  }
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/** Prefer alt_name when the primary name uses OSM's [:optional:] markup. */
function cleanName(tags: Record<string, string>): string | null {
  const raw = tags.name ?? "";
  const source = raw.includes("[:") && tags.alt_name ? tags.alt_name : raw;
  const cleaned = source.replaceAll("[:", "").replaceAll(":]", "").replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function lineFrom(geometry: Array<{ lat: number; lon: number }> | undefined): { line: number[][]; anchor: number[][] } | null {
  if (!geometry || geometry.length < 2) return null;
  const anchor = geometry.map((point) => [round(point.lon), round(point.lat)]);
  const simplified = simplifyLine(anchor, 0.00008).map((point) => [round(point[0]), round(point[1])]);
  return simplified.length >= 2 ? { line: simplified, anchor } : null;
}

function draftsFrom(payload: { elements?: Array<Record<string, unknown>> }): Draft[] {
  const elements = payload.elements ?? [];
  const memberWays = new Set<number>();
  for (const element of elements) {
    if (element.type !== "relation") continue;
    const members = element.members as Array<{ type?: string; ref?: number }> | undefined;
    for (const member of members ?? []) {
      if (member.type === "way" && typeof member.ref === "number") memberWays.add(member.ref);
    }
  }
  const drafts: Draft[] = [];
  for (const element of elements) {
    const tags = (element.tags ?? {}) as Record<string, string>;
    const osm = `${element.type}/${element.id}`;
    if (element.type === "relation" && tags["piste:type"] === "downhill") {
      const lines: number[][][] = [];
      const anchors: number[][][] = [];
      const members = element.members as Array<{ type?: string; geometry?: Array<{ lat: number; lon: number }> }> | undefined;
      for (const member of members ?? []) {
        if (member.type !== "way") continue;
        const shaped = lineFrom(member.geometry);
        if (!shaped) continue;
        lines.push(shaped.line);
        anchors.push(shaped.anchor);
      }
      if (lines.length > 0) {
        drafts.push({
          lines,
          anchors,
          kind: "piste",
          difficulty: normalizeDifficulty(tags["piste:difficulty"]),
          name: cleanName(tags),
          aerialway: null,
          osm,
        });
      }
      continue;
    }
    if (element.type !== "way" || typeof element.id !== "number") continue;
    const geometry = element.geometry as Array<{ lat: number; lon: number }> | undefined;
    const shaped = lineFrom(geometry);
    if (!shaped) continue;
    if (tags["piste:type"] === "downhill" && !memberWays.has(element.id)) {
      drafts.push({
        lines: [shaped.line],
        anchors: [shaped.anchor],
        kind: "piste",
        difficulty: normalizeDifficulty(tags["piste:difficulty"]),
        name: cleanName(tags),
        aerialway: null,
        osm,
      });
    }
    if (tags.aerialway && liftTypes.has(tags.aerialway)) {
      drafts.push({
        lines: [shaped.line],
        anchors: [shaped.anchor],
        kind: "lift",
        difficulty: null,
        name: cleanName(tags),
        aerialway: tags.aerialway,
        osm,
      });
    }
  }
  return drafts;
}

function nearestResort(draft: Draft): { resort: ResortPoint; distance: number } | null {
  let best: { resort: ResortPoint; distance: number } | null = null;
  for (const resort of resorts) {
    let distance = Infinity;
    for (const line of draft.anchors) {
      for (const point of line) {
        const km = distanceKm(resort, { lat: point[1], lon: point[0] });
        if (km < distance) distance = km;
      }
    }
    if (!best || distance < best.distance) best = { resort, distance };
  }
  if (!best || best.distance > radiusKm(best.resort)) return null;
  return best;
}

async function main() {
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  const groups = clusters();
  const elements: Array<Record<string, unknown>> = [];
  const seenElements = new Set<string>();
  console.log(`Fetching ${groups.length} Overpass batches for ${resorts.length} resorts`);
  for (let index = 0; index < groups.length; index++) {
    const group = groups[index];
    const key = createHash("sha1").update(group.map((resort) => resort.id).sort().join("\n")).digest("hex").slice(0, 12);
    const cachePath = join(rawDir, `${key}.json`);
    let payload: OverpassPayload;
    if (!refresh && existsSync(cachePath)) {
      const cached = JSON.parse(readFileSync(cachePath, "utf8")) as OverpassPayload;
      if (usablePayload(cached)) {
        payload = cached;
        console.log(`cache ${index + 1}/${groups.length} ${key} (${cached.elements?.length ?? 0} elements)`);
      } else {
        console.log(`query ${index + 1}/${groups.length} ${group.map((resort) => resort.id).join(", ")} (replacing unusable cache)`);
        payload = await fetchGroup(group);
        writeFileSync(cachePath, stripPortalUrls(JSON.stringify(payload)));
        console.log(`  stored ${payload.elements?.length ?? 0} elements`);
      }
    } else {
      console.log(`query ${index + 1}/${groups.length} ${group.map((resort) => resort.id).join(", ")}`);
      payload = await fetchGroup(group);
      writeFileSync(cachePath, stripPortalUrls(JSON.stringify(payload)));
      console.log(`  stored ${payload.elements?.length ?? 0} elements`);
    }
    for (const element of payload.elements ?? []) {
      const id = `${element.type}/${element.id}`;
      if (seenElements.has(id)) continue;
      seenElements.add(id);
      elements.push(element);
    }
  }
  const drafts = draftsFrom({ elements });

  const byResort = new Map<string, Draft[]>();
  let dropped = 0;
  for (const draft of drafts) {
    const match = nearestResort(draft);
    if (!match) {
      dropped += 1;
      continue;
    }
    const list = byResort.get(match.resort.id) ?? [];
    list.push(draft);
    byResort.set(match.resort.id, list);
  }

  let files = 0;
  let features = 0;
  for (const name of readdirSync(outDir)) {
    if (name.endsWith(".geojson")) unlinkSync(join(outDir, name));
  }
  for (const [id, list] of byResort) {
    const collection = {
      type: "FeatureCollection",
      features: list.map((draft) => ({
        type: "Feature",
        properties: {
          kind: draft.kind,
          difficulty: draft.difficulty,
          name: draft.name,
          aerialway: draft.aerialway,
          osm: draft.osm,
        },
        geometry:
          draft.lines.length === 1
            ? { type: "LineString", coordinates: draft.lines[0] }
            : { type: "MultiLineString", coordinates: draft.lines },
      })),
    };
    writeFileSync(join(outDir, `${id}.geojson`), JSON.stringify(collection));
    files += 1;
    features += collection.features.length;
  }
  const summary = {
    generated: new Date().toISOString().slice(0, 10),
    resortsWithPistes: files,
    features,
    droppedOutsideRadius: dropped,
    note: "Built by scripts/fetch-pistes.ts from OpenStreetMap via the Overpass API. Not refreshed in CI.",
  };
  writeFileSync(join(root, "data", "pistes", "summary.json"), JSON.stringify(summary, null, 2));
  console.log(summary);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
