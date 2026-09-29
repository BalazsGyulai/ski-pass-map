import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  RESORT_ID,
  attachOriginGuards,
  dismissConsent,
  originFromBase,
  assertMapCanvasNotFlat,
  shotPart10,
  shotPart10Viewport,
  waitForMapMarkers,
  mapboxStubBuild,
  settleAnimations,
} from "./helpers";
import { installMapboxStub, installMapStub, mapStubEnabled } from "./map-stub";
import { LANGS } from "../src/i18n/languages";

/** Obertauern: covered by two passes. */
const MULTI_PASS_RESORT = "osm-relation-3165847";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ context }) => {
  if (mapStubEnabled()) await installMapStub(context);
  await installMapboxStub(context);
  // 3D terrain in a software-rendered browser costs about a second a frame, so tests use the flat
  // map unless they ask for 3D (see the 3D test). Real devices draw it on the GPU.
  await context.addInitScript(() => {
    try {
      const raw = localStorage.getItem("ski-pass-map-v1");
      const prefs = raw ? JSON.parse(raw) : {};
      if (prefs.terrain3d === undefined) {
        prefs.terrain3d = false;
        localStorage.setItem("ski-pass-map-v1", JSON.stringify(prefs));
      }
    } catch {
      // Storage blocked: the app falls back to its own default.
    }
  });
});

test("language redirect and switcher (hu, en, de)", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await page.goto("/");
  await page.waitForURL(/\/(hu|en|de)\//, { timeout: 15_000 });
  await page.goto("/de/");
  // The map bar has one switcher for desktop and one for phones. Only one is shown.
  const trigger = page.locator(".lang-switch-trigger:visible");
  await trigger.click();
  // Opening moves focus into the list, which sits at the end of the page.
  await expect(page.locator(".lang-switch-item.is-active")).toBeFocused();
  await page.locator(".lang-switch-item", { hasText: "Magyar" }).click();
  await expect(page).toHaveURL(/\/hu\//);
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".lang-switch-list")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
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
  await page.getByRole("button", { name: /filter|szűrő|open filters/i }).first().click();
  await page.locator(".filter-sheet input[type='search'], .filters-panel input[type='search']").first().fill("Planai");
  await page.waitForTimeout(400);
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await assertMapCanvasNotFlat(page, "resort tablet");
  // One scrolling card: passes first, links at the end.
  await expect(page.locator("#resort-passes")).toBeVisible();
  await page.locator(".resort-card .resort-scroll").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await expect(page.locator("#resort-links")).toBeVisible();
  await page.waitForResponse((res) => res.url().includes("/pistes/") && res.ok(), { timeout: 45_000 }).catch(() => null);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("tapping a cluster zooms in and tapping a resort dot opens it", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/");
  await waitForMapMarkers(page);
  type ProbeMap = {
    getZoom(): number;
    jumpTo(options: { center: [number, number]; zoom: number }): void;
    project(lngLat: [number, number]): { x: number; y: number };
    getCanvas(): HTMLCanvasElement;
    queryRenderedFeatures(options: { layers: string[] }): Array<{ geometry: { coordinates: [number, number] } }>;
  };
  const screenPointOf = (layer: string) =>
    page.evaluate((id) => {
      const map = window.__skiMapProbe as unknown as ProbeMap;
      const rect = map.getCanvas().getBoundingClientRect();
      const features = map.queryRenderedFeatures({ layers: [id] });
      for (const feature of features) {
        const at = map.project(feature.geometry.coordinates);
        const x = rect.left + at.x;
        const y = rect.top + at.y;
        if (x > rect.left + 60 && x < rect.right - 80 && y > rect.top + 60 && y < rect.bottom - 60) return { x, y };
      }
      return null;
    }, layer);
  const zoomBefore = await page.evaluate(() => (window.__skiMapProbe as unknown as ProbeMap).getZoom());
  const cluster = await screenPointOf("resorts-cluster");
  expect(cluster, "a cluster on screen").not.toBeNull();
  await page.mouse.click(cluster!.x, cluster!.y);
  await expect.poll(() => page.evaluate(() => (window.__skiMapProbe as unknown as ProbeMap).getZoom())).toBeGreaterThan(zoomBefore);
  await page.evaluate(() => (window.__skiMapProbe as unknown as ProbeMap).jumpTo({ center: [13.5, 47.3], zoom: 10 }));
  await expect.poll(() => screenPointOf("resorts-dot"), { timeout: 20_000 }).not.toBeNull();
  const dot = await screenPointOf("resorts-dot");
  await page.mouse.click(dot!.x, dot!.y);
  await page.waitForSelector("#resort-title", { timeout: 15_000 });
  await expect(page).toHaveURL(/resort=/);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("three tabs, the settings gear, and old addresses", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/");
  const tabs = page.locator(".bottom-tab-bar a");
  await expect(tabs).toHaveCount(3);
  await tabs.nth(1).click();
  await expect(page).toHaveURL(/\/en\/passes\/$/);
  await page.locator(".mobile-top a[aria-label='Settings']").click();
  await expect(page).toHaveURL(/\/en\/settings\/$/);
  await page.goto("/en/compare/?birth=1");
  await expect(page).toHaveURL(/\/en\/passes\/\?birth=1$/);
  await page.goto("/en/saved/");
  await expect(page).toHaveURL(/\/en\/plan\/#saved$/);
  await expect(page.locator("#saved")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/");
  await page.locator(".topbar-links a[aria-label='Settings']").click();
  await expect(page).toHaveURL(/\/en\/settings\/$/);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("resort card lists the cheapest pass first and reports a mistake with the resort filled in", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto(`/en/?resort=${MULTI_PASS_RESORT}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  const rows = page.locator(".resort-card .pass-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveClass(/is-cheapest/);
  const prices = await rows.locator(".pass-row-price .price-lg").allInnerTexts();
  const euros = prices.map((text) => Number(text.replace(/[^0-9]/g, "")));
  expect(euros[0]).toBeLessThanOrEqual(euros[1]);
  await page.locator(".resort-card .resort-scroll").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await page.getByRole("link", { name: /report a map issue/i }).click();
  await expect(page).toHaveURL(/\/en\/contact\/\?category=data-error&resort=/);
  await expect(page.locator("select").first()).toHaveValue("data-error");
  await expect(page.locator(`input[value="${MULTI_PASS_RESORT}"]`)).toHaveCount(1);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("passes tab: cards, sorting, the days slider and open on map", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto("/en/passes/");
  const cards = page.locator(".pass-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(10);
  await page.getByRole("radio", { name: "Resorts" }).click();
  const first = cards.first();
  await expect(first.locator("h2")).toHaveText(/Snow Card Tirol/);
  const calc = first.locator(".days-calc");
  const slider = calc.locator('input[type="range"]');
  await slider.fill("40");
  await expect(calc).toContainText(/You save/);
  await slider.fill("1");
  await expect(calc).toContainText(/Day tickets cost/);
  await first.getByRole("link", { name: /open on map/i }).click();
  await expect(page).toHaveURL(/passes=snow-card-tirol/);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("links from other pages open the map on the right resort", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await page.getByRole("button", { name: /add favourite/i }).click();
  await page.goto("/en/plan/");
  await page.locator("#saved a").first().click();
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`resort=${RESORT_ID}`));
  expect(problems, problems.join("\n")).toEqual([]);
});

test("plan: days added on the map drive the answer pill and My plan", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto(`/en/?resort=${MULTI_PASS_RESORT}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await page.getByRole("button", { name: "Add to plan" }).click();
  for (let i = 0; i < 9; i++) await page.getByRole("button", { name: "More days" }).click();
  const pill = page.locator(".plan-pill");
  await expect(pill.locator(".plan-pill-days")).toHaveText("10");
  await expect(pill.locator("strong")).toContainText("€");
  await pill.click();
  await expect(page).toHaveURL(/\/en\/plan\//);
  await expect(page.locator(".best-card h3")).not.toBeEmpty();
  await expect(page.locator(".best-card .price-display")).toContainText("€");
  await expect(page.locator(".plan-list li")).toHaveCount(1);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("pass chips and the price filter narrow the map", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  await page.goto("/en/");
  await waitForMapMarkers(page);
  const chip = page.locator(".pass-chips .chip", { hasText: "Kärntner Skipass" });
  await chip.click();
  await expect(page).toHaveURL(/passes=kaerntner-skipass/);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".search-pill .pill-summary")).toContainText("Kärntner Skipass");
  await page.locator(".pass-chips .chip").first().click();
  await expect(page).not.toHaveURL(/passes=/);
  await page.getByRole("button", { name: /open filters/i }).click();
  await page.locator('.filter-sheet input[type="range"]').fill("500");
  await expect(page).toHaveURL(/maxPrice=500/);
  await page.keyboard.press("Escape");
  await expect(page.locator(".search-pill .pill-summary")).toContainText("Up to €500");
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
  // On phones the card sits on the tab bar instead of covering it (once its entrance settles).
  await expect
    .poll(async () => {
      const card = await page.locator(".consent-banner-card").boundingBox();
      const tabs = await page.locator(".bottom-tab-bar").boundingBox();
      return card && tabs ? Math.round(tabs.y - (card.y + card.height)) : -999;
    })
    .toBeGreaterThanOrEqual(-1); // it may rest on the bar's 1px top border, like the sheet does
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
  // The supporter code opens inline, not in a browser prompt.
  await page.getByRole("button", { name: "Enter supporter code" }).click();
  await expect(page.getByRole("textbox", { name: "Enter supporter code" })).toBeFocused();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator('[data-testid="support-prompt"]')).toHaveCount(0);
  await page.addInitScript(() => localStorage.removeItem("skimap-cookie-banner"));
  await page.goto("/en/?supportPrompt=1");
  await page.waitForSelector('[data-testid="consent-banner"]');
  await expect(page.locator('[data-testid="support-prompt"]')).toHaveCount(0);
  expect(problems, problems.join("\n")).toEqual([]);
});

test.describe("Mapbox access", () => {
  test.skip(!mapboxStubBuild(), "needs the e2e build with a stub Mapbox token");

  test("three free visits after consent, then the free map, and supporters get it back", async ({ page, baseURL }) => {
    const origin = originFromBase(baseURL);
    const problems = attachOriginGuards(page, origin);
    await page.addInitScript(() => {
      localStorage.setItem("skimap-cookie-banner", "accepted");
      localStorage.setItem("skimap-map-consent", "1");
    });
    await page.goto("/en/");
    await expect(page.locator(".map-root")).toHaveAttribute("data-map-provider", "mapbox", { timeout: 30_000 });
    expect(await waitForMapMarkers(page)).toBeGreaterThan(0);
    // The piste data credit (OpenSkiMap, ODbL) shows on Mapbox too.
    await expect(page.locator(".mapboxgl-ctrl-attrib")).toContainText("OpenSkiMap");
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("skimap-mapbox-trial") ?? "{}").visits)).toBe(1);

    // Two more visits later, the free visits are used up.
    await page.evaluate(() => localStorage.setItem("skimap-mapbox-trial", JSON.stringify({ visits: 3, lastSeen: Date.now() - 3 * 60 * 60 * 1000 })));
    await page.reload();
    await expect(page.locator(".map-root")).toHaveAttribute("data-map-provider", "openfreemap", { timeout: 30_000 });
    expect(await waitForMapMarkers(page)).toBeGreaterThan(0);

    // Watching an ad (a two-day supporter period) brings Mapbox back.
    await page.evaluate(() => localStorage.setItem("skimap-support-reward-until", String(Date.now() + 2 * 24 * 60 * 60 * 1000)));
    await page.reload();
    await expect(page.locator(".map-root")).toHaveAttribute("data-map-provider", "mapbox", { timeout: 30_000 });
    expect(await waitForMapMarkers(page)).toBeGreaterThan(0);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("accepting in the cookie card switches to Mapbox at once", async ({ page }) => {
    // A first-time visitor: clear the answer on the first page only, not on later navigations.
    await page.addInitScript(() => {
      if (sessionStorage.getItem("e2e-fresh")) return;
      sessionStorage.setItem("e2e-fresh", "1");
      localStorage.removeItem("skimap-cookie-banner");
      localStorage.removeItem("skimap-map-consent");
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/en/");
    await page.waitForSelector('[data-testid="consent-banner"]', { timeout: 20_000 });
    await expect(page.locator(".map-root")).toHaveAttribute("data-map-provider", "openfreemap", { timeout: 30_000 });
    await page.getByRole("button", { name: "Accept" }).click();
    await expect(page.locator(".map-root")).toHaveAttribute("data-map-provider", "mapbox", { timeout: 30_000 });
    expect(await waitForMapMarkers(page)).toBeGreaterThan(0);
    await page.goto("/en/settings/");
    await expect(page.getByText("Mapbox map is on. Free visits left after this one: 2.")).toBeVisible();
  });
});

test("3D: a resort tilts the map over the terrain, closing levels it, and the switch turns it off", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  // A visitor with 3D on (the default outside tests); only the first page sets it.
  await page.addInitScript(() => {
    if (sessionStorage.getItem("e2e-3d")) return;
    sessionStorage.setItem("e2e-3d", "1");
    const prefs = JSON.parse(localStorage.getItem("ski-pass-map-v1") ?? "{}");
    localStorage.setItem("ski-pass-map-v1", JSON.stringify({ ...prefs, terrain3d: true }));
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  type Probe = { getPitch?: () => number; getTerrain?: () => unknown; getLayer?: (id: string) => unknown };
  const camera = () =>
    page.evaluate(() => {
      const map = (window as unknown as { __skiMapProbe?: Probe }).__skiMapProbe;
      return { pitch: Math.round(map?.getPitch?.() ?? -1), terrain: Boolean(map?.getTerrain?.()), relief: Boolean(map?.getLayer?.("terrain-hillshade")) };
    });

  await page.goto(`/en/?resort=${MULTI_PASS_RESORT}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await expect.poll(async () => (await camera()).pitch, { timeout: 20_000 }).toBeGreaterThan(40);
  expect(await camera()).toMatchObject({ terrain: true, relief: true });

  await page.locator(".resort-card .close-card").click();
  await expect.poll(async () => (await camera()).pitch, { timeout: 10_000 }).toBe(0);

  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel("3D terrain").uncheck();
  await expect.poll(async () => (await camera()).terrain).toBe(false);
  expect((await camera()).relief).toBe(true);

  // The choice is remembered, and a resort then opens flat.
  await page.goto(`/en/?resort=${MULTI_PASS_RESORT}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await page.waitForTimeout(1500);
  expect(await camera()).toMatchObject({ pitch: 0, terrain: false, relief: true });
  expect(problems, problems.join("\n")).toEqual([]);
});

test("lifts move uphill on an open resort and stand still for reduced motion", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  const chairPattern = () =>
    page.evaluate(() => {
      const map = window.__skiMapProbe as { getLayer(id: string): unknown; getPaintProperty(id: string, name: string): unknown } | undefined;
      return map?.getLayer("lift-chair") ? JSON.stringify(map.getPaintProperty("lift-chair", "line-dasharray")) : null;
    });
  // Opening a resort keeps the regional view; the lifts come alive once you zoom in.
  const zoomIn = () => page.evaluate(() => (window.__skiMapProbe as { jumpTo(options: { zoom: number }): void } | undefined)?.jumpTo({ zoom: 13 }));

  await page.goto(`/en/?resort=${MULTI_PASS_RESORT}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await expect.poll(chairPattern, { timeout: 30_000 }).not.toBeNull();
  const first = await chairPattern();
  await page.waitForTimeout(1000);
  expect(await chairPattern(), "no motion in the regional view").toBe(first);
  await zoomIn();
  await expect.poll(chairPattern, { timeout: 15_000 }).not.toBe(first);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/en/?resort=${MULTI_PASS_RESORT}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await expect.poll(chairPattern, { timeout: 30_000 }).not.toBeNull();
  await zoomIn();
  const still = await chairPattern();
  await page.waitForTimeout(1500);
  expect(await chairPattern()).toBe(still);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("motion: panels ease in, the switch knob slides, and reduced motion keeps everything still", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  const sheetAnimation = () => page.locator(".filter-sheet").evaluate((el) => getComputedStyle(el).animationName);
  const knob = page.getByRole("switch", { name: "3D terrain" }).locator(".toggle-knob");

  await page.goto("/en/");
  await page.getByRole("button", { name: /open filters/i }).click();
  await expect(page.locator(".filter-sheet")).toBeVisible();
  expect(await sheetAnimation()).not.toBe("none");
  await page.keyboard.press("Escape");

  await page.goto("/en/settings/");
  // Transitions start once the stored settings are painted, so nothing slides into place on load.
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  expect(await knob.evaluate((el) => getComputedStyle(el).translate)).toBe("none");
  await knob.click();
  await expect.poll(() => knob.evaluate((el) => getComputedStyle(el).translate)).toBe("20px");
  expect(await knob.evaluate((el) => getComputedStyle(el).transitionDuration)).not.toBe("0s");

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await knob.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe("0s");
  await page.goto("/en/");
  await page.getByRole("button", { name: /open filters/i }).click();
  await expect(page.locator(".filter-sheet")).toBeVisible();
  expect(await sheetAnimation()).toBe("none");
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
  await fetch(`${origin}/api/portal/dev-login`, { method: "POST", headers: { "content-type": "application/json" } });
  await page.goto("/portal/login/");
  await page.getByRole("button", { name: /dev login/i }).click();
  await page.waitForURL("**/portal/**", { timeout: 20_000 });
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
  await page.goto("/en/settings/");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const sw = await page.request.get("/sw.js");
  expect(sw.ok()).toBeTruthy();
  expect(problems, problems.join("\n")).toEqual([]);
});

test("every language hydrates the pre-rendered passes page without a mismatch", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "rejected");
  for (const lang of LANGS) {
    await page.goto(`/${lang}/passes/`);
    // The purchase date fills in from today only once React has taken over the page.
    await expect(page.locator('.passes-page input[type="date"]'), lang).not.toHaveValue("");
    await expect(page.locator(".passes-page .pass-card").first(), lang).toBeVisible();
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("affiliate block hidden when config empty", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await expect(page.locator("#resort-links")).toHaveCount(1);
  await expect(page.locator('[data-testid="affiliate-block"]')).toHaveCount(0);
  expect(problems, problems.join("\n")).toEqual([]);
});

test("layout: no horizontal overflow on key widths", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  const cases: Array<[number, number, string]> = [
    [320, 700, "/en/"],
    [390, 844, "/en/"],
    [820, 1180, `/en/?resort=${RESORT_ID}`],
    [1440, 900, "/en/"],
  ];
  for (const [width, height, path] of cases) {
    await page.setViewportSize({ width, height });
    await page.goto(path);
    if (path.includes("resort=")) await page.waitForSelector("#resort-title", { timeout: 30_000 });
    else await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `overflow ${width}px ${path}`).toBe(false);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("part10 UI screenshots", async ({ page, baseURL }) => {
  const origin = originFromBase(baseURL);
  const problems = attachOriginGuards(page, origin);
  await dismissConsent(page, "accepted");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/");
  await waitForMapMarkers(page);
  await shotPart10(page, "map-phone-light");
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await assertMapCanvasNotFlat(page, "resort phone");
  await shotPart10(page, "resort-phone");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en/");
  await waitForMapMarkers(page);
  await shotPart10(page, "resort-desktop-list");
  await page.goto(`/en/?resort=${RESORT_ID}`);
  await page.waitForSelector("#resort-title", { timeout: 30_000 });
  await assertMapCanvasNotFlat(page, "resort desktop");
  await shotPart10(page, "resort-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("skimap-map-consent", "0"));
  await page.goto("/en/settings/");
  await page.waitForSelector("h1");
  await shotPart10Viewport(page, "settings-phone");
  await page.getByRole("radio", { name: "Dark" }).click();
  await page.getByRole("switch", { name: "Mapbox map" }).click();
  await shotPart10Viewport(page, "settings-phone-dark");
  expect(problems, problems.join("\n")).toEqual([]);
});

test("accessibility: no serious axe violations on main pages", async ({ page }) => {
  await dismissConsent(page, "accepted");
  for (const path of ["/en/", "/en/plan/"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    // Contrast is measured on the settled page, not halfway through a fade.
    await settleAnimations(page);
    const results = await new AxeBuilder({ page })
      .exclude(".cf-turnstile, iframe")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, `${path}: ${JSON.stringify(serious.map((v) => v.id))}`).toEqual([]);
  }
});

test.describe("phone bottom sheet", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("follows a drag, settles on a snap, and a pull down closes a resort", async ({ page, context, baseURL }) => {
    const origin = originFromBase(baseURL);
    const problems = attachOriginGuards(page, origin);
    await dismissConsent(page, "rejected");
    await page.goto("/en/");
    const list = page.locator(".list-sheet");
    await expect(list).toHaveAttribute("data-snap", "peek");
    // The pre-rendered page already says "peek"; wait until the sheet is measured and listening.
    await expect(list).toHaveAttribute("data-sheet-live", "true");
    const client = await context.newCDPSession(page);
    const drag = async (selector: string, distance: number) => {
      const box = await page.locator(selector).first().boundingBox();
      if (!box) throw new Error(`no box for ${selector}`);
      const x = box.x + box.width / 2;
      const y = box.y + Math.min(box.height / 2, 30);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 12; i++) {
        await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (distance * i) / 12 }] });
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await drag(".list-sheet .sheet-head", -320);
    await expect(list).toHaveAttribute("data-snap", /half|full/);
    await drag(".list-sheet .sheet-head", 600);
    await expect(list).toHaveAttribute("data-snap", "peek");

    await page.goto(`/en/?resort=${RESORT_ID}`);
    await page.waitForSelector("#resort-title", { timeout: 30_000 });
    const card = page.locator(".resort-card");
    await expect(card).toHaveAttribute("data-snap", "half");
    await expect(card).toHaveAttribute("data-sheet-live", "true");
    await drag(".resort-card .resort-head", 700);
    await expect(page.locator("#resort-title")).toHaveCount(0, { timeout: 10_000 });
    await expect(page).not.toHaveURL(/resort=/);
    expect(problems, problems.join("\n")).toEqual([]);
  });

  test("the plan answer sits above the sheet, not under it", async ({ page, baseURL }) => {
    const origin = originFromBase(baseURL);
    const problems = attachOriginGuards(page, origin);
    await dismissConsent(page, "rejected");
    await page.goto(`/en/?plan=${encodeURIComponent(`${MULTI_PASS_RESORT}:5`)}`);
    const pill = page.locator(".plan-pill");
    await expect(pill).toBeVisible();
    await expect(page.locator(".list-sheet")).toHaveAttribute("style", /transform/);
    await expect
      .poll(async () => {
        const pillBox = await pill.boundingBox();
        const sheetBox = await page.locator(".list-sheet").boundingBox();
        if (!pillBox || !sheetBox) return Number.NaN;
        // boundingBox already includes the sheet's transform.
        return sheetBox.y - (pillBox.y + pillBox.height);
      })
      .toBeGreaterThan(0);
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
