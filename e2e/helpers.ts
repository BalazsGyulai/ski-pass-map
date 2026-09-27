import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const RESORT_ID = "skimap-12357";
export const ARTIFACTS_DIR = "/opt/cursor/artifacts/screenshots/part10";

let shotsTaken = 0;
const MAX_SHOTS = 6;

const MIN_MAP_CANVAS_VARIANCE = 6;

export function originFromBase(baseURL: string | undefined): string {
  return (baseURL ?? "http://127.0.0.1:8835").replace(/\/$/, "");
}

export function attachOriginGuards(page: Page, origin: string): string[] {
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (text.includes("favicon")) return;
      if (text.includes("frame-ancestors") && text.includes("<meta>")) return;
      if (text.includes("404") && text.includes("Not Found")) return;
      problems.push(`console: ${text}`);
    }
  });
  // Uncaught errors, including React's hydration mismatches (#418), which only show up here.
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!url.startsWith(origin)) return;
    if (url.includes("mapbox") || url.includes("openfreemap") || url.includes("opensnowmap")) return;
    const reason = req.failure()?.errorText ?? "";
    // A navigation cancels requests that are still in flight. That is the browser, not the server.
    if (reason.includes("ERR_ABORTED")) return;
    problems.push(`requestfailed: ${url} ${reason}`);
  });
  page.on("response", (res) => {
    const url = res.url();
    if (!url.startsWith(origin)) return;
    if (res.status() >= 400 && !url.includes("/api/map-load") && !url.includes("does-not-exist")) {
      problems.push(`http ${res.status()}: ${url}`);
    }
  });
  return problems;
}

export async function shotPart10(page: Page, name: string, options?: { fullPage?: boolean }): Promise<void> {
  if (shotsTaken >= MAX_SHOTS) return;
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const file = path.join(ARTIFACTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: options?.fullPage ?? true });
  shotsTaken += 1;
  console.log("screenshot", file);
}

export async function shotPart10Viewport(page: Page, name: string): Promise<void> {
  await shotPart10(page, name, { fullPage: false });
}

/**
 * Answers the cookie banner before the page loads. An accepting visitor here has already used their
 * free Mapbox visits, so the suite stays on the free map (and spends no map loads); the Mapbox
 * tests set up their own visitor.
 */
export async function dismissConsent(page: Page, choice: "accepted" | "rejected"): Promise<void> {
  await page.addInitScript((c) => {
    localStorage.setItem("skimap-cookie-banner", c);
    if (c === "accepted") {
      localStorage.setItem("skimap-map-consent", "1");
      localStorage.setItem("skimap-mapbox-trial", JSON.stringify({ visits: 99, lastSeen: 1 }));
    } else localStorage.setItem("skimap-map-consent", "0");
  }, choice);
}

/** The e2e build carries a stub Mapbox token only when the runner says so (see scripts/run-e2e.mjs). */
export function mapboxStubBuild(): boolean {
  return process.env.E2E_MAPBOX_STUB_TOKEN === "1";
}

/** Resort dots and clusters are map layers. Requires NEXT_PUBLIC_MAP_CANVAS_PROBE=1 at build time. */
export async function countRenderedResorts(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = window.__skiMapProbe as
      | { getLayer?: (id: string) => unknown; queryRenderedFeatures?: (options: { layers: string[] }) => unknown[] }
      | undefined;
    if (!map?.queryRenderedFeatures || !map.getLayer) return 0;
    const layers = ["resorts-dot", "resorts-cluster", "resort-focus-dot"].filter((id) => map.getLayer?.(id));
    if (layers.length === 0) return 0;
    try {
      return map.queryRenderedFeatures({ layers }).length;
    } catch {
      return 0;
    }
  });
}

export async function waitForMapMarkers(page: Page): Promise<number> {
  await page.waitForSelector(".maplibregl-canvas, .mapboxgl-canvas", { timeout: 45_000 });
  for (let i = 0; i < 40; i++) {
    const n = await countRenderedResorts(page);
    if (n > 0) return n;
    await page.waitForTimeout(500);
  }
  return countRenderedResorts(page);
}

/** Requires NEXT_PUBLIC_MAP_CANVAS_PROBE=1 at build time (preserveDrawingBuffer). */
export async function assertMapCanvasNotFlat(page: Page, label: string): Promise<void> {
  await page.waitForSelector(".maplibregl-canvas, .mapboxgl-canvas", { timeout: 45_000 });
  await page.waitForFunction(() => typeof window.__skiMapCanvasVariance === "function", { timeout: 45_000 });
  await page.evaluate(async () => {
    const map = window.__skiMapProbe;
    if (!map) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        map.off("idle", done);
        resolve();
      };
      if (map.loaded() && map.isStyleLoaded()) map.once("idle", done);
      else map.on("idle", done);
    });
  });
  for (let attempt = 0; attempt < 24; attempt++) {
    const sample = await page.evaluate((minVariance) => {
      const map = window.__skiMapProbe as {
        isStyleLoaded?: () => boolean;
        getContainer?: () => HTMLElement;
        queryRenderedFeatures?: (point: [number, number]) => unknown[];
      } | undefined;
      const variance = window.__skiMapCanvasVariance?.() ?? 0;
      const styleLoaded = Boolean(map?.isStyleLoaded?.());
      const container = map?.getContainer?.();
      const w = container?.clientWidth ?? 0;
      const h = container?.clientHeight ?? 0;
      let featureHits = 0;
      if (map?.queryRenderedFeatures && w > 0 && h > 0) {
        const points: Array<[number, number]> = [
          [w * 0.45, h * 0.22],
          [w * 0.62, h * 0.3],
          [w * 0.38, h * 0.42],
        ];
        for (const point of points) {
          try {
            if (map.queryRenderedFeatures(point).length > 0) featureHits += 1;
          } catch {
            // ignore transient style gaps
          }
        }
      }
      let markers = 0;
      try {
        const probe = map as unknown as { getLayer?: (id: string) => unknown; queryRenderedFeatures?: (options: { layers: string[] }) => unknown[] };
        const layers = ["resorts-dot", "resorts-cluster", "resort-focus-dot"].filter((id) => probe.getLayer?.(id));
        markers = layers.length > 0 ? (probe.queryRenderedFeatures?.({ layers }).length ?? 0) : 0;
      } catch {
        markers = 0;
      }
      const ok =
        styleLoaded &&
        w > 16 &&
        h > 16 &&
        (variance >= minVariance || featureHits >= 1 || markers >= 1);
      return { ok, variance, featureHits, markers, styleLoaded, w, h };
    }, MIN_MAP_CANVAS_VARIANCE);
    if (sample.ok) return;
    await page.waitForTimeout(500);
  }
  const last = await page.evaluate((minVariance) => {
    const map = window.__skiMapProbe as {
      isStyleLoaded?: () => boolean;
      getContainer?: () => HTMLElement;
      queryRenderedFeatures?: (point: [number, number]) => unknown[];
    } | undefined;
    const container = map?.getContainer?.();
    const w = container?.clientWidth ?? 0;
    const h = container?.clientHeight ?? 0;
    let featureHits = 0;
    if (map?.queryRenderedFeatures && w > 0 && h > 0) {
      try {
        featureHits = map.queryRenderedFeatures([w * 0.5, h * 0.3]).length;
      } catch {
        featureHits = 0;
      }
    }
    return {
      variance: window.__skiMapCanvasVariance?.() ?? 0,
      featureHits,
      markers: (() => {
        try {
          const probe = map as unknown as { getLayer?: (id: string) => unknown; queryRenderedFeatures?: (options: { layers: string[] }) => unknown[] };
          const layers = ["resorts-dot", "resorts-cluster", "resort-focus-dot"].filter((id) => probe.getLayer?.(id));
          return layers.length > 0 ? (probe.queryRenderedFeatures?.({ layers }).length ?? 0) : 0;
        } catch {
          return 0;
        }
      })(),
      styleLoaded: Boolean(map?.isStyleLoaded?.()),
      size: [w, h],
      minVariance,
    };
  }, MIN_MAP_CANVAS_VARIANCE);
  throw new Error(
    `${label}: map looks empty (variance=${last.variance}, features=${last.featureHits}, markers=${last.markers}, style=${last.styleLoaded}, size=${last.size.join("x")})`,
  );
}
