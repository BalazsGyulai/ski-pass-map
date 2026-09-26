import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const RESORT_ID = "skimap-12357";
export const ARTIFACTS_DIR = "/opt/cursor/artifacts/screenshots/part10";

let shotsTaken = 0;
const MAX_SHOTS = 15;

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
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!url.startsWith(origin)) return;
    if (url.includes("mapbox") || url.includes("openfreemap") || url.includes("opensnowmap")) return;
    problems.push(`requestfailed: ${url} ${req.failure()?.errorText ?? ""}`);
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

export async function shotPart10(page: Page, name: string): Promise<void> {
  if (shotsTaken >= MAX_SHOTS) return;
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const file = path.join(ARTIFACTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  shotsTaken += 1;
  console.log("screenshot", file);
}

export async function dismissConsent(page: Page, choice: "accepted" | "rejected"): Promise<void> {
  await page.addInitScript((c) => {
    localStorage.setItem("skimap-cookie-banner", c);
    if (c === "accepted") localStorage.setItem("skimap-map-consent", "1");
    else localStorage.setItem("skimap-map-consent", "0");
  }, choice);
}

export async function waitForMapMarkers(page: Page): Promise<number> {
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45_000 });
  for (let i = 0; i < 12; i++) {
    const n = await page.locator(".maplibregl-marker").count();
    if (n > 0) return n;
    await page.waitForTimeout(500);
  }
  const listRows = await page.locator(".list-sheet .resort-card, .list-sheet li").count();
  if (listRows > 0) return listRows;
  return page.locator(".maplibregl-marker").count();
}

/** Requires NEXT_PUBLIC_MAP_CANVAS_PROBE=1 at build time (preserveDrawingBuffer). */
export async function assertMapCanvasNotFlat(page: Page, label: string): Promise<void> {
  await page.waitForSelector(".maplibregl-canvas", { timeout: 45_000 });
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
      const markers = document.querySelectorAll(".maplibregl-marker").length;
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
      markers: document.querySelectorAll(".maplibregl-marker").length,
      styleLoaded: Boolean(map?.isStyleLoaded?.()),
      size: [w, h],
      minVariance,
    };
  }, MIN_MAP_CANVAS_VARIANCE);
  throw new Error(
    `${label}: map looks empty (variance=${last.variance}, features=${last.featureHits}, markers=${last.markers}, style=${last.styleLoaded}, size=${last.size.join("x")})`,
  );
}
