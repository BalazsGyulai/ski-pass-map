import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../out/index.html", import.meta.url), "utf8");
const css = html.match(/\/_next\/static\/css\/([A-Za-z0-9_-]+)\.css/);
if (!css) {
  console.error("Built HTML has no CSS asset to version the service worker.");
  process.exit(1);
}

let sha = "local";
try {
  sha = (process.env.GITHUB_SHA || execSync("git rev-parse HEAD", { encoding: "utf8" })).trim().slice(0, 12);
} catch {
  sha = "local";
}

const id = `${sha}-${css[1].slice(0, 8)}`;
const file = new URL("../out/sw.js", import.meta.url);
const source = readFileSync(file, "utf8");
if (!source.includes("__BUILD_ID__")) {
  console.error("out/sw.js is missing __BUILD_ID__. The public worker was not copied into the export.");
  process.exit(1);
}

const site = JSON.parse(readFileSync(new URL("../config/site.json", import.meta.url), "utf8"));
const configured = process.env.NEXT_PUBLIC_BASE_PATH;
const basePath = configured === undefined ? site.basePath : configured;
const prefix = basePath === "" ? "" : basePath;
const stamped = source.replaceAll("__BUILD_ID__", id).replaceAll("/ski-pass-map", prefix);
const manifestFile = new URL("../out/manifest.webmanifest", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const rewrite = (value) => (typeof value === "string" ? value.replaceAll("/ski-pass-map", prefix || "") : value);
manifest.name = site.name;
manifest.short_name = site.name;
manifest.start_url = basePath === "" ? "/" : `${basePath}/`;
manifest.scope = basePath === "" ? "/" : `${basePath}/`;
if (Array.isArray(manifest.icons)) {
  for (const icon of manifest.icons) icon.src = rewrite(icon.src);
}
writeFileSync(file, stamped);
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`service worker cache ski-pass-map-${id} basePath=${basePath === "" ? "/" : basePath}`);
