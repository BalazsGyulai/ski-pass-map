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

writeFileSync(file, source.replaceAll("__BUILD_ID__", id));
console.log(`service worker cache ski-pass-map-${id}`);
