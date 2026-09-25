import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const root = new URL("..", import.meta.url).pathname;
const outDir = join(root, "out");
const cssFile = join(root, "src/app/globals.css");
const port = 4173;
const origin = `http://127.0.0.1:${port}`;
const pageUrl = `${origin}/ski-pass-map/`;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".geojson": "application/geo+json",
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", origin);
    if (!url.pathname.startsWith("/ski-pass-map")) {
      res.writeHead(404);
      res.end();
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice("/ski-pass-map".length));
    if (rel.endsWith("/")) rel += "index.html";
    const file = join(outDir, rel);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404, { "content-type": "text/html; charset=utf-8", "cache-control": "max-age=600" });
      res.end("missing");
      return;
    }
    res.writeHead(200, {
      "content-type": types[extname(file)] || "application/octet-stream",
      "cache-control": "max-age=600",
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function build() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`build exited ${code}`))));
  });
}

function cssHref(html) {
  const match = html.match(/\/ski-pass-map\/_next\/static\/css\/[^"]+\.css/);
  if (!match) throw new Error("no css in built html");
  return match[0];
}

async function styledState(page) {
  return page.evaluate(async () => {
    const link = document.querySelector('link[rel="stylesheet"]');
    const href = link?.getAttribute("href") ?? "";
    const bg = getComputedStyle(document.body).backgroundColor;
    const response = href ? await fetch(href) : null;
    const keys = await caches.keys();
    return {
      href,
      status: response?.status ?? 0,
      bg,
      keys,
      text: document.body.innerText.slice(0, 80),
    };
  });
}

const originalCss = await readFile(cssFile, "utf8");
const server = await serve();
const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  console.log("build A");
  await build();
  const firstCss = cssHref(await readFile(join(outDir, "index.html"), "utf8"));
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", (msg) => console.log("page", msg.type(), msg.text()));
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch((error) => {
    console.log("initial navigation restarted", error.message.split("\n")[0]);
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
  await page.waitForFunction(
    () => {
      const bg = getComputedStyle(document.body).backgroundColor;
      return bg === "rgb(238, 242, 244)" || bg === "rgb(14, 20, 24)";
    },
    null,
    { timeout: 20000 },
  );
  const before = await styledState(page);
  console.log("before", before);
  if (!before.href.includes(firstCss)) throw new Error(`expected ${firstCss}, got ${before.href}`);
  if (before.status !== 200) throw new Error(`first css status ${before.status}`);

  await page.evaluate(async () => {
    const cache = await caches.open("ski-pass-map-v1");
    await cache.put(
      new Request("/ski-pass-map/"),
      new Response("<!doctype html><link rel=stylesheet href=/ski-pass-map/_next/static/css/missing.css>", {
        headers: { "content-type": "text/html" },
      }),
    );
  });

  console.log("build B");
  await writeFile(cssFile, `${originalCss}\n:root { --deploy-mark: ${Date.now()}; }\n`);
  await build();
  const secondCss = cssHref(await readFile(join(outDir, "index.html"), "utf8"));
  if (secondCss === firstCss) throw new Error("css hash did not change");
  await unlink(join(outDir, firstCss.slice("/ski-pass-map/".length))).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  console.log("removed", firstCss, "new", secondCss);

  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 }).catch((error) => {
    console.log("reload restarted", error.message.split("\n")[0]);
  });
  try {
    await page.waitForFunction(
      (href) => document.querySelector('link[rel="stylesheet"]')?.getAttribute("href") === href,
      secondCss,
      { timeout: 20000 },
    );
  } catch (error) {
    console.log("after reload", await styledState(page).catch((err) => err.message));
    throw error;
  }
  await page.waitForFunction(
    () => {
      const bg = getComputedStyle(document.body).backgroundColor;
      return bg === "rgb(238, 242, 244)" || bg === "rgb(14, 20, 24)";
    },
    null,
    { timeout: 20000 },
  );
  const swSource = await readFile(join(outDir, "sw.js"), "utf8");
  const cacheName = swSource.match(/const CACHE = "([^"]+)"/)?.[1];
  if (!cacheName) throw new Error("stamped cache name missing");
  const deadline = Date.now() + 20000;
  let keys = [];
  let registrationState = {};
  while (Date.now() < deadline) {
    registrationState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration?.update();
      return {
        keys: await caches.keys(),
        installing: registration?.installing?.state ?? null,
        waiting: registration?.waiting?.state ?? null,
      };
    });
    keys = registrationState.keys;
    if (keys.length === 1 && keys[0] === cacheName) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  if (!(keys.length === 1 && keys[0] === cacheName)) {
    throw new Error(`cache did not update to ${cacheName}: ${JSON.stringify(registrationState)}`);
  }
  const after = await styledState(page);
  console.log("after", after);
  if (after.status !== 200) throw new Error(`new css status ${after.status}`);
  if (after.href !== secondCss) throw new Error(`stylesheet is ${after.href}`);
  console.log("SW OK");
  await context.close();
} finally {
  await writeFile(cssFile, originalCss);
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
