import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ARTIFACTS = "/opt/cursor/artifacts/screenshots/part7";
const SIZES = [
  { tag: "phone", width: 390, height: 844 },
  { tag: "tablet", width: 820, height: 1180 },
  { tag: "desktop", width: 1440, height: 900 },
];
const PORT = Number(process.env.E2E_PORT ?? 8810 + Math.floor(Math.random() * 40));
const ORIGIN = `http://127.0.0.1:${PORT}`;
const RESORT_ID = "skimap-12357";
const RESORT_NAME = "Grünberg Obsteig";
const wranglerPath = path.join(process.cwd(), "wrangler.toml");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripAiBinding(toml) {
  return toml.replace(/\n# Enable on the Pages project[^\n]*\n\[ai\]\nbinding = "AI"\n/, "\n");
}

async function shotAll(page, baseName) {
  for (const { tag, width, height } of SIZES) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(350);
    const file = path.join(ARTIFACTS, `${baseName}-${tag}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("saved", file);
  }
}

function seedOverridesAndPromo(origin) {
  const sourceUrl = `${origin}/fixtures/source.html`;
  const attr = JSON.stringify({
    resortName: RESORT_NAME,
    updatedAt: "2026-09-26T12:00:00.000Z",
    sourceUrl,
  });
  const fields = JSON.stringify({ season_dates: "2026/27" });
  const now = Date.now();
  const seedPath = path.join(process.cwd(), "scripts/e2e-seed-portal.sql");
  fs.writeFileSync(
    seedPath,
    `INSERT OR REPLACE INTO runtime_overrides (resort_id, fields_json, attribution_json, source_url, edit_id, published_at)
VALUES ('${RESORT_ID}', '${fields.replace(/'/g, "''")}', '${attr.replace(/'/g, "''")}', '${sourceUrl}', 'e2e-edit', ${now});
INSERT OR REPLACE INTO promos (id, resort_id, text, link_url, logo_url, owner_licence_accepted, status, submitted_by, created_at)
VALUES ('e2e-promo', '${RESORT_ID}', 'Early season offer — visit our official site.', NULL, NULL, 1, 'approved', 'e2e', ${now});
`,
  );
  execSync(`npx wrangler d1 execute skimap-app --local --file=${seedPath} -y`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  try {
    execSync('pkill -f "wrangler pages dev" || true', { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  await sleep(1500);
  execSync("npm run db:migrate:local", { stdio: "inherit" });
  execSync(
    "CF_PAGES=1 NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_PORTAL_ENABLED=1 NEXT_PUBLIC_PORTAL_DEV_BYPASS=1 NEXT_PUBLIC_ADMIN_DEV_EMAIL=dev@skimap.test NEXT_PUBLIC_PORTAL_DEV_EMAIL=portal-dev@skimap.test npm run build",
    { stdio: "inherit" },
  );
  const wranglerBackup = fs.readFileSync(wranglerPath, "utf8");
  fs.writeFileSync(wranglerPath, stripAiBinding(wranglerBackup));
  fs.writeFileSync(
    path.join(process.cwd(), ".dev.vars"),
    [
      "ADMIN_DEV_BYPASS=1",
      "ADMIN_EMAILS=dev@skimap.test",
      "PORTAL_ENABLED=1",
      "PORTAL_DEV_BYPASS=1",
      "PORTAL_DEV_EMAIL=portal-dev@skimap.test",
      "MAP_LOAD_HASH_SALT=e2e-salt-portal",
      "SOURCE_CHECKER_DEV_FIXTURE=1",
      "SOURCE_CHECKER_DEV_HOSTS=127.0.0.1,localhost",
      "TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA",
    ].join("\n"),
  );

  const wrangler = spawn(
    "npx",
    ["wrangler", "pages", "dev", "out", "--port", String(PORT), "--ip", "127.0.0.1"],
    {
      env: { ...process.env, NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let ready = false;
  wrangler.stdout.on("data", (buf) => {
    const text = buf.toString();
    process.stdout.write(text);
    if (text.includes("Ready on")) ready = true;
  });
  wrangler.stderr.on("data", (buf) => process.stderr.write(buf));
  for (let i = 0; i < 90 && !ready; i++) await sleep(500);
  if (!ready) throw new Error("wrangler did not become ready");

  await fetch(`${ORIGIN}/api/portal/dev-login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-portal-dev-email": "portal-dev@skimap.test" },
  });
  seedOverridesAndPromo(ORIGIN);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${ORIGIN}/portal/login/`, { waitUntil: "domcontentloaded" });
    await shotAll(page, "portal-login");

    await page.goto(`${ORIGIN}/portal/login/`, { waitUntil: "domcontentloaded" });
    await page.click('button:has-text("Dev login")');
    await page.waitForURL("**/portal/**", { timeout: 15000 });
    await page.waitForSelector(`text=${RESORT_NAME}`, { timeout: 15000 });
    await shotAll(page, "portal-dashboard-edit-de");

    await page.goto(`${ORIGIN}/portal/promo/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Resort promotion", { timeout: 10000 });
    await shotAll(page, "portal-promo-en");

    await page.goto(`${ORIGIN}/admin/`, { waitUntil: "domcontentloaded" });
    await page.click('button:has-text("Portal")');
    await page.waitForTimeout(500);
    await shotAll(page, "admin-portal-queue");

    await page.goto(`${ORIGIN}/en/for-resorts/`, { waitUntil: "domcontentloaded" });
    await shotAll(page, "for-resorts-en");

    const overridesRes = await fetch(`${ORIGIN}/api/overrides`);
    const overridesJson = await overridesRes.json();
    if (!overridesJson.attributions?.[RESORT_ID]) {
      throw new Error(`overrides missing attribution for ${RESORT_ID}: ${JSON.stringify(overridesJson).slice(0, 400)}`);
    }
    await page.goto(`${ORIGIN}/en/?resort=${RESORT_ID}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#resort-title", { timeout: 20000 });
    await page.waitForFunction(
      () => document.querySelector("[data-testid=portal-attribution]") && document.querySelector("[data-testid=portal-promo]"),
      { timeout: 45000 },
    );
    await shotAll(page, "resort-sheet-attribution-promo");
  } finally {
    await browser.close();
    wrangler.kill("SIGKILL");
    fs.writeFileSync(wranglerPath, wranglerBackup);
    try {
      execSync('pkill -f "wrangler pages dev" || true', { stdio: "ignore" });
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
