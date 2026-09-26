import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 8835);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const wranglerPath = path.join(process.cwd(), "wrangler.toml");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripAiBinding(toml) {
  return toml.replace(/\n# Enable on the Pages project[^\n]*\n\[ai\]\nbinding = "AI"\n/, "\n");
}

async function main() {
  try {
    execSync('pkill -f "wrangler pages dev" || true', { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  await sleep(1200);
  execSync("npm run db:migrate:local", { stdio: "inherit" });
  execSync('npx wrangler d1 execute skimap-app --local --command "DELETE FROM rate_limits;" -y', {
    stdio: "inherit",
  });
  execSync(
    [
      "CF_PAGES=1",
      "NEXT_PUBLIC_BASE_PATH=",
      "NEXT_PUBLIC_PORTAL_ENABLED=1",
      "NEXT_PUBLIC_PORTAL_DEV_BYPASS=1",
      "NEXT_PUBLIC_ADMIN_DEV_EMAIL=dev@skimap.test",
      "NEXT_PUBLIC_PORTAL_DEV_EMAIL=portal-dev@skimap.test",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA",
      "NEXT_PUBLIC_STATS_ENABLED=1",
      "NEXT_PUBLIC_SUPPORT_PROMPT_FORCE=1",
      "npm run build",
    ].join(" "),
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
      "MAP_LOAD_HASH_SALT=e2e-salt-part9",
      "SOURCE_CHECKER_DEV_FIXTURE=1",
      "SOURCE_CHECKER_DEV_HOSTS=127.0.0.1,localhost",
      "TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA",
      "STATS_ENABLED=1",
      "SUPPORT_CODE_SALT=e2e-support-salt",
      "KOFI_VERIFICATION_TOKEN=e2e-kofi-token",
    ].join("\n"),
  );

  const child = spawn("npx", ["wrangler", "pages", "dev", "out", "--port", String(PORT), "--ip", "127.0.0.1"], {
    env: { ...process.env, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let ready = false;
  child.stdout.on("data", (buf) => {
    const t = buf.toString();
    if (t.includes("Ready on")) ready = true;
    process.stdout.write(t);
  });
  child.stderr.on("data", (buf) => process.stderr.write(buf));

  const shutdown = () => {
    try {
      child.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    if (fs.existsSync(wranglerPath)) fs.writeFileSync(wranglerPath, wranglerBackup);
  };
  process.on("exit", shutdown);
  process.on("SIGINT", () => {
    shutdown();
    process.exit(130);
  });

  for (let i = 0; i < 120 && !ready; i++) await sleep(500);
  if (!ready) {
    shutdown();
    throw new Error("wrangler pages dev did not become ready");
  }

  try {
    execSync("npx playwright test e2e/regression.spec.ts", {
      stdio: "inherit",
      env: { ...process.env, E2E_ORIGIN: ORIGIN },
    });
  } finally {
    shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
