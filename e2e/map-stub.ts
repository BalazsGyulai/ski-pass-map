import type { BrowserContext, Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Offline stand-in for the OpenFreeMap basemap, for machines that cannot reach the tile host.
 * Turn it on with E2E_MAP_STUB=1. The stub style draws a plain background plus hillshade from the
 * public AWS terrain tiles, proxied through the OpenFreeMap host so the page's CSP still applies.
 * Glyphs come from E2E_GLYPHS_DIR (a folder of `<start>-<end>.pbf` or `.pbf.gz` files) when set.
 */
export function mapStubEnabled(): boolean {
  return process.env.E2E_MAP_STUB === "1";
}

const DEM_PREFIX = "https://tiles.openfreemap.org/__e2e-dem/";
const MAPBOX_DEM_PREFIX = "https://api.mapbox.com/__e2e-dem/";
const TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/";

function stubStyle(dark: boolean, host: "openfreemap" | "mapbox" = "openfreemap") {
  const dem = host === "mapbox" ? MAPBOX_DEM_PREFIX : DEM_PREFIX;
  return {
    version: 8,
    name: dark ? "e2e-dark" : "e2e-light",
    glyphs: host === "mapbox" ? "mapbox://fonts/mapbox/{fontstack}/{range}.pbf" : "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      dem: { type: "raster-dem", tiles: [`${dem}{z}/{x}/{y}.png`], tileSize: 256, encoding: "terrarium", maxzoom: 12 },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": dark ? "#0d1320" : "#eef1f4" } },
      {
        id: "hillshade",
        type: "hillshade",
        source: "dem",
        paint: {
          "hillshade-exaggeration": 0.45,
          "hillshade-shadow-color": dark ? "#000000" : "#5b6778",
          "hillshade-highlight-color": dark ? "#2a3446" : "#ffffff",
          "hillshade-accent-color": dark ? "#111827" : "#94a3b8",
        },
      },
    ],
  };
}

function readGlyph(range: string): Buffer | null {
  const dir = process.env.E2E_GLYPHS_DIR;
  if (!dir) return null;
  const plain = path.join(dir, `${range}.pbf`);
  if (fs.existsSync(plain)) return fs.readFileSync(plain);
  const gz = `${plain}.gz`;
  if (fs.existsSync(gz)) return zlib.gunzipSync(fs.readFileSync(gz));
  return null;
}

async function fulfillDem(route: Route, tilePath: string): Promise<void> {
  try {
    const response = await fetch(`${TERRARIUM}${tilePath}`);
    if (!response.ok) throw new Error(String(response.status));
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(await response.arrayBuffer()) });
  } catch {
    await route.fulfill({ status: 404, body: "" });
  }
}

async function handle(route: Route): Promise<void> {
  const url = route.request().url();
  if (url.startsWith("https://tiles.openfreemap.org/styles/")) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stubStyle(url.includes("/dark"))) });
    return;
  }
  if (url.startsWith(DEM_PREFIX)) {
    await fulfillDem(route, url.slice(DEM_PREFIX.length));
    return;
  }
  if (url.startsWith("https://tiles.openfreemap.org/fonts/")) {
    const range = decodeURIComponent(url.split("/").pop() ?? "").replace(/\.pbf$/, "");
    const glyph = readGlyph(range);
    if (glyph) await route.fulfill({ status: 200, contentType: "application/x-protobuf", body: glyph });
    else await route.fulfill({ status: 404, body: "" });
    return;
  }
  await route.fulfill({ status: 404, body: "" });
}

/**
 * Stand-in for the Mapbox API. The e2e build carries a fake token, so the real API is never
 * reachable; this serves the same quiet style as the OpenFreeMap stub, the glyphs, and empty
 * answers for session and telemetry pings. Installed for every test, stub or not.
 */
async function handleMapbox(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  if (url.pathname.startsWith("/styles/v1/")) {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stubStyle(url.pathname.includes("dark"), "mapbox")) });
    return;
  }
  if (url.pathname.startsWith("/__e2e-dem/")) {
    await fulfillDem(route, url.pathname.slice("/__e2e-dem/".length));
    return;
  }
  if (url.pathname.startsWith("/fonts/v1/")) {
    const range = decodeURIComponent(url.pathname.split("/").pop() ?? "").replace(/\.pbf$/, "");
    const glyph = readGlyph(range);
    if (glyph) await route.fulfill({ status: 200, contentType: "application/x-protobuf", body: glyph });
    else await route.fulfill({ status: 404, body: "" });
    return;
  }
  await route.fulfill({ status: 204, body: "" });
}

export async function installMapboxStub(context: BrowserContext): Promise<void> {
  await context.route("https://api.mapbox.com/**", handleMapbox);
  await context.route("https://events.mapbox.com/**", (route) => route.fulfill({ status: 204, body: "" }));
}

export async function installMapStub(context: BrowserContext): Promise<void> {
  await context.route("https://tiles.openfreemap.org/**", handle);
  await context.route("https://tiles.opensnowmap.org/**", (route) => route.fulfill({ status: 404, body: "" }));
  // Offline sandboxes cannot reach Cloudflare either. An empty script keeps the page quiet.
  await context.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  await context.route("https://static.cloudflareinsights.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
}
