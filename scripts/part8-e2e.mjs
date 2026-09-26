import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ARTIFACTS = "/opt/cursor/artifacts/screenshots/part8";
const PORT = Number(process.env.E2E_PORT ?? 8820 + Math.floor(Math.random() * 40));
const ORIGIN = `http://127.0.0.1:${PORT}`;
const RESORT_ID = "skimap-12357";
const wranglerPath = path.join(process.cwd(), "wrangler.toml");
const affiliatesPath = path.join(process.cwd(), "config/affiliates.json");
const affiliatesBackup = fs.readFileSync(affiliatesPath, "utf8");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripAiBinding(toml) {
  return toml.replace(/\n# Enable on the Pages project[^\n]*\n\[ai\]\nbinding = "AI"\n/, "\n");
}

async function shot(page, name, width, height) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(400);
  const file = path.join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("saved", file);
}

async function main() {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(
    affiliatesPath,
    JSON.stringify(
      {
        ski_rental: [{ label: "E2E demo rental", url: "https://example.test/rent", category: "ski_rental" }],
      },
      null,
      2,
    ),
  );
  try {
    execSync('pkill -f "wrangler pages dev" || true', { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  await sleep(1200);
  execSync("npm run db:migrate:local", { stdio: "inherit" });
  execSync(
    "CF_PAGES=1 NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_ADMIN_DEV_EMAIL=dev@skimap.test NEXT_PUBLIC_STATS_ENABLED=1 NEXT_PUBLIC_SUPPORT_PROMPT_FORCE=1 npm run build",
    { stdio: "inherit" },
  );
  const wranglerBackup = fs.readFileSync(wranglerPath, "utf8");
  fs.writeFileSync(wranglerPath, stripAiBinding(wranglerBackup));
  fs.writeFileSync(
    path.join(process.cwd(), ".dev.vars"),
    ["ADMIN_DEV_BYPASS=1", "ADMIN_EMAILS=dev@skimap.test", "STATS_ENABLED=1", "SUPPORT_CODE_SALT=e2e-salt"].join("\n"),
  );
  const child = spawn("npx", ["wrangler", "pages", "dev", "out", `--port=${PORT}`, "--local"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  child.stdout.on("data", (buf) => {
    const t = buf.toString();
    if (t.includes("http")) ready = true;
    process.stdout.write(t);
  });
  child.stderr.on("data", (buf) => process.stderr.write(buf));
  for (let i = 0; i < 90 && !ready; i++) await sleep(1000);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.removeItem("skimap-cookie-banner");
    localStorage.removeItem("skimap-map-consent");
  });
  await page.goto(`${ORIGIN}/hu/`);
  await page.waitForSelector('[data-testid="consent-banner"]', { timeout: 20000 });
  await shot(page, "consent-banner-hu-phone", 390, 844);
  await shot(page, "consent-banner-hu-desktop", 1440, 900);

  await page.goto(`${ORIGIN}/hu/privacy/`);
  await page.waitForSelector(".legal-page h1", { timeout: 15000 });
  await shot(page, "privacy-hu-phone", 390, 844);
  await shot(page, "privacy-hu-desktop", 1440, 900);

  await page.goto(`${ORIGIN}/en/imprint/`);
  await page.waitForSelector(".legal-page h1", { timeout: 15000 });
  await shot(page, "imprint-en-phone", 390, 844);
  await shot(page, "imprint-en-desktop", 1440, 900);

  await page.goto(`${ORIGIN}/en/?supportPrompt=1`);
  await page.waitForSelector('[data-testid="support-prompt"]', { timeout: 15000 });
  await shot(page, "support-prompt-en-phone", 390, 844);
  await shot(page, "support-prompt-en-desktop", 1440, 900);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${ORIGIN}/en/?resort=${RESORT_ID}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#resort-title", { timeout: 30000 });
  await page.click("#tab-links");
  await page.waitForSelector('[data-testid="affiliate-block"]', { timeout: 10000 });
  await shot(page, "resort-links-affiliate-phone", 390, 844);
  await shot(page, "resort-links-affiliate-desktop", 1440, 900);

  await page.goto(`${ORIGIN}/admin/`);
  await page.getByRole("button", { name: /Stats/i }).click();
  await page.waitForSelector(".admin-stats", { timeout: 15000 });
  await shot(page, "admin-stats-tablet", 820, 1180);
  await shot(page, "admin-stats-desktop", 1440, 900);

  await browser.close();
  child.kill("SIGTERM");
  fs.writeFileSync(wranglerPath, wranglerBackup);
  fs.writeFileSync(affiliatesPath, affiliatesBackup);
  console.log("part8 e2e done");
}

main().catch((err) => {
  fs.writeFileSync(affiliatesPath, affiliatesBackup);
  console.error(err);
  process.exit(1);
});
