import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ARTIFACTS = "/opt/cursor/artifacts/screenshots";
const PORT = Number(process.env.E2E_PORT ?? 8800 + Math.floor(Math.random() * 50));
const ORIGIN = `http://127.0.0.1:${PORT}`;
const wranglerPath = path.join(process.cwd(), "wrangler.toml");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripAiBinding(toml) {
  return toml.replace(/\n# Enable on the Pages project[^\n]*\n\[ai\]\nbinding = "AI"\n/, "\n");
}

async function shot(page, name, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(400);
  const file = path.join(ARTIFACTS, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
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
    "CF_PAGES=1 NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_PORTAL_ENABLED=1 NEXT_PUBLIC_ADMIN_DEV_EMAIL=dev@skimap.test NEXT_PUBLIC_PORTAL_DEV_EMAIL=portal-dev@skimap.test npm run build",
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

  const wrangler = spawn("npx", ["wrangler", "pages", "dev", "out", "--port", String(PORT), "--ip", "127.0.0.1"], {
    env: { ...process.env, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  wrangler.stdout.on("data", (buf) => {
    const text = buf.toString();
    process.stdout.write(text);
    if (text.includes("Ready on")) ready = true;
  });
  wrangler.stderr.on("data", (buf) => process.stderr.write(buf));
  for (let i = 0; i < 90 && !ready; i++) await sleep(500);
  if (!ready) throw new Error("wrangler did not become ready");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${ORIGIN}/en/for-resorts/`, { waitUntil: "domcontentloaded" });
    await shot(page, "for-resorts-en-phone.png", 390, 844);

    await fetch(`${ORIGIN}/api/portal/dev-login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-portal-dev-email": "portal-dev@skimap.test" },
    });
    const meRes = await fetch(`${ORIGIN}/api/portal/me`, { credentials: "include" });
    const me = await meRes.json();
    await fetch(`${ORIGIN}/api/portal/edits`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": me.csrfToken ?? "dev-csrf-token",
        "x-portal-dev-email": "portal-dev@skimap.test",
      },
      body: JSON.stringify({
        entityType: "resort",
        entityId: "skimap-12357",
        sourceUrl: `${ORIGIN}/fixtures/source.html`,
        changes: [{ path: "seasonDates.value", before: "2025/26", after: "2026/27", kind: "date" }],
        before: { seasonDates: { value: "2025/26" } },
        after: { seasonDates: { value: "2026/27" } },
      }),
    });
    execSync(
      `npx wrangler d1 execute skimap-app --local --command "INSERT OR REPLACE INTO promos (id, resort_id, text, link_url, logo_url, owner_licence_accepted, status, submitted_by, created_at) VALUES ('e2e-promo', 'skimap-12357', 'Early season offer on our site.', NULL, NULL, 1, 'approved', 'e2e', ${Date.now()})"`,
      { stdio: "inherit", cwd: process.cwd() },
    );
    await page.goto(`${ORIGIN}/portal/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=skimap-12357", { timeout: 15000 });
    await shot(page, "portal-dashboard-de-tablet.png", 820, 1180);

    await page.goto(`${ORIGIN}/admin/`, { waitUntil: "domcontentloaded" });
    await page.click('button:has-text("Portal")');
    await page.waitForTimeout(600);
    await shot(page, "admin-portal-queue-desktop.png", 1440, 900);

    await page.goto(`${ORIGIN}/en/?resort=skimap-12357`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await shot(page, "resort-attribution-desktop.png", 1440, 900);
  } finally {
    await browser.close();
    wrangler.kill();
    fs.writeFileSync(wranglerPath, wranglerBackup);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
