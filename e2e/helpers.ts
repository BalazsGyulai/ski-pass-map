import type { Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export const RESORT_ID = "skimap-12357";
export const ARTIFACTS_DIR = "/opt/cursor/artifacts/screenshots/part9";

let shotsTaken = 0;
const MAX_SHOTS = 10;

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

export async function shotPart9(page: Page, name: string): Promise<void> {
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
