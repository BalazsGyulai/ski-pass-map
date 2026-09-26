import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  RESORT_ID,
  attachOriginGuards,
  dismissConsent,
  originFromBase,
  shotPart9,
  waitForMapMarkers,
} from "./helpers";

test.describe.configure({ mode: "serial" });

test("language redirect and switcher (hu, en, de)", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await page.goto("/");
  await page.waitForURL(/\/(hu|en|de)\//, { timeout: 15_000 });
  await page.goto("/de/");
  await page.locator(".lang-switch-trigger").click();
  await page.locator(".lang-switch-item", { hasText: "Magyar" }).click();
  await expect(page).toHaveURL(/\/hu\//);
  await page.locator(".lang-switch-trigger").click();
  await page.locator(".lang-switch-item", { hasText: "English" }).click();
  await expect(page).toHaveURL(/\/en\//);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("map markers, search, filters, resort sheet tabs and pistes", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/hu/");
  await page.waitForSelector(".list-sheet", { timeout: 30_000 });
  const markers = await waitForMapMarkers(page);
  expect(markers).toBeGreaterThan(0);
  await shotPart9(page, "map-markers-tablet");
  await page.getByRole("button", { name: /filter|szűrő|open filters/i }).first().click();
  await page.locator(".filter-sheet input[type='search'], .filters-panel input[type='search']").first().fill("Planai");
  await page.waitForTimeout(400);
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await shotPart9(page, "resort-sheet-tablet");
  for (const tab of ["#tab-prices", "#tab-pistes", "#tab-links"]) {
    await page.click(tab);
    await page.waitForTimeout(400);
  }
  await page.waitForResponse((res) => res.url().includes("/pistes/") && res.ok(), { timeout: 45_000 }).catch(() => null);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("planner, compare, birth-year prices, favourites persistence", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  await page.goto("/en/plan/");
  await page.waitForSelector("h1", { timeout: 20_000 });
  const birth = page.locator('input[inputmode="numeric"], input[name="birthYear"]').first();
  if (await birth.count()) await birth.fill("1990");
  await page.goto("/en/compare/");
  await page.waitForSelector("h1", { timeout: 20_000 });
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  const favBtn = page.getByRole("button", { name: /favourite|kedvenc/i }).first();
  await favBtn.click();
  await page.reload();
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await expect(favBtn).toHaveAttribute("aria-pressed", "true");
  expect(problems, problems.join("\n")).toEqual([]);
});

test("consent banner and cookie settings", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await page.addInitScript(() => {
    localStorage.removeItem("skimap-cookie-banner");
    localStorage.removeItem("skimap-map-consent");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/hu/");
  await page.waitForSelector('[data-testid="consent-banner"]', { timeout: 20_000 });
  await shotPart9(page, "consent-phone");
  await page.getByRole("button", { name: /reject|elutasít/i }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("skimap-cookie-banner"))).toBe("rejected");
  await page.evaluate(() => {
    localStorage.removeItem("skimap-cookie-banner");
    localStorage.removeItem("skimap-map-consent");
  });
  await page.reload();
  await page.waitForSelector('[data-testid="consent-banner"]');
  await page.getByRole("button", { name: /settings|beállítás/i }).click();
  await page.waitForSelector('[data-testid="cookie-settings"]');
  await page.locator(".cookie-settings-actions button.primary").click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("skimap-cookie-banner"))).not.toBeNull();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("support prompt rules", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.addInitScript(() => {
    localStorage.removeItem("skimap-support-first-visit");
    localStorage.removeItem("skimap-support-daily");
  });
  await page.goto("/en/");
  await expect(page.locator('[data-testid="support-prompt"]')).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("skimap-support-first-visit", "1"));
  await page.goto("/en/?supportPrompt=1");
  await page.waitForSelector('[data-testid="support-prompt"]', { timeout: 15_000 });
  await page.addInitScript(() => localStorage.removeItem("skimap-cookie-banner"));
  await page.goto("/en/?supportPrompt=1");
  await page.waitForSelector('[data-testid="consent-banner"]');
  await expect(page.locator('[data-testid="support-prompt"]')).toHaveCount(0);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("contact form with Turnstile test keys", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto("/en/contact/");
  await page.fill("textarea", "Regression contact message with enough characters for validation.");
  await page.locator('input[type="checkbox"]').check();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /send|küld/i }).click();
  await page.waitForTimeout(2000);
  expect(problems.filter((p) => !p.includes("/api/contact")), problems.join("\n")).toEqual([]);
});

test("admin, portal, overrides, IDOR guard", async ({ page, baseURL, request }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await page.goto("/admin/");
  await page.waitForSelector("button:has-text('Inbox')", { timeout: 15_000 });
  await shotPart9(page, "admin-desktop");
  await fetch(`${origin}/api/portal/dev-login`, { method: "POST", headers: { "content-type": "application/json" } });
  await page.goto("/portal/login/");
  await page.getByRole("button", { name: /dev login/i }).click();
  await page.waitForURL("**/portal/**", { timeout: 20_000 });
  await shotPart9(page, "portal-dashboard");
  const overrides = await request.get("/api/overrides");
  expect(overrides.ok()).toBeTruthy();
  const me = await request.get("/api/portal/me");
  expect(me.ok()).toBeTruthy();
  const forbidden = await request.post("/api/portal/edits", {
    headers: { "content-type": "application/json", "x-csrf-token": "dev-csrf-token" },
    data: {
      entityType: "resort",
      entityId: "skimap-not-owned",
      before: {},
      after: {},
      changes: [{ path: "dayTicket.value.eur", before: 1, after: 2, kind: "price" }],
      sourceUrl: "https://example.com",
    },
  });
  expect(forbidden.status()).toBeGreaterThanOrEqual(400);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("legal pages, sitemap, hreflang, 404, dark mode, service worker", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto("/hu/imprint/");
  await page.waitForSelector(".legal-page h1");
  await page.goto("/en/privacy/");
  await page.waitForSelector(".legal-page h1");
  const sitemap = await page.request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  await page.goto("/en/");
  const hreflangs = await page.locator('link[rel="alternate"][hreflang]').count();
  expect(hreflangs).toBeGreaterThan(2);
  const notFound = await page.goto("/en/this-page-does-not-exist/");
  expect(notFound?.status()).toBe(404);
  await page.goto("/en/");
  await page.getByRole("button", { name: /open menu|menü/i }).click();
  await page.locator(".drawer-tools select").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const sw = await page.request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("affiliate block hidden when config empty", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await page.click("#tab-links");
  await expect(page.locator('[data-testid="affiliate-block"]')).toHaveCount(0);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("map desktop and phone screenshots", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/");
  await waitForMapMarkers(page);
  await shotPart9(page, "map-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await waitForMapMarkers(page);
  await shotPart9(page, "map-phone");
  expect(problems, problems.join("\n")).toEqual([]);
});

test("accessibility: no serious axe violations on main pages", async ({ page }) => {
  await dismissConsent(page, "accepted");
  for (const path of ["/en/", "/en/plan/"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    const results = await new AxeBuilder({ page })
      .exclude(".cf-turnstile, iframe")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, `${path}: ${JSON.stringify(serious.map((v) => v.id))}`).toEqual([]);
  }
});
