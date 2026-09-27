import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ARTIFACTS = "/opt/cursor/artifacts/screenshots";
const BASE = process.env.E2E_BASE_PATH ?? "";
const PORT = 8788;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const wranglerPath = path.join(process.cwd(), "wrangler.toml");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function execSyncSafe(cmd) {
  execSync(cmd, { stdio: "inherit" });
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
  execSyncSafe("npm run db:migrate:local");
  execSyncSafe(
    "CF_PAGES=1 NEXT_PUBLIC_BASE_PATH= NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build",
  );
  const wranglerBackup = fs.readFileSync(wranglerPath, "utf8");
  const stripped = stripAiBinding(wranglerBackup);
  if (stripped.includes("[ai]")) throw new Error("Failed to strip [ai] binding from wrangler.toml for local e2e");
  fs.writeFileSync(wranglerPath, stripped);
  fs.writeFileSync(
    path.join(process.cwd(), ".dev.vars"),
    [
      "ADMIN_DEV_BYPASS=1",
      "ADMIN_EMAILS=dev@skimap.test",
      "MAP_LOAD_HASH_SALT=e2e-salt-1234567890",
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
  if (!ready) throw new Error("wrangler pages dev did not become ready");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${ORIGIN}${BASE}/hu/contact/`, { waitUntil: "domcontentloaded" });
    await page.fill("textarea", "Ez egy teszt üzenet a kapcsolati űrlapról, legalább tíz karakter.");
    await page.check('input[type="checkbox"]');
    await page.waitForTimeout(2000);
    await shot(page, "contact-hu-phone.png", 390, 844);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    await page.goto(`${ORIGIN}${BASE}/en/contact/`, { waitUntil: "domcontentloaded" });
    await shot(page, "contact-en-tablet.png", 820, 1180);

    for (let i = 0; i < 6; i++) {
      await fetch(`${ORIGIN}${BASE}/api/contact`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({
          lang: "en",
          category: "general",
          message: `Rate limit probe message number ${i} with enough length.`,
          privacyAccepted: true,
          turnstileToken: "dummy-token",
        }),
      });
    }

    await page.goto(`${ORIGIN}${BASE}/admin/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await shot(page, "admin-inbox-desktop.png", 1440, 900);
    await page.click('button:has-text("Edit queue")');
    await page.click('button:has-text("Create test edit")');
    await page.waitForTimeout(3000);
    await shot(page, "admin-edits-checker-desktop.png", 1440, 900);
  } finally {
    await browser.close();
    wrangler.kill("SIGTERM");
    fs.writeFileSync(wranglerPath, wranglerBackup);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
