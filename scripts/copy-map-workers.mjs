/**
 * MapLibre's default worker URL is derived from import.meta.url. Next's webpack
 * build rewrites that to a file:// path, which MapLibre then refuses. Copy the
 * published worker and its sibling module into public/vendor as .js so a static
 * host can serve them with a JavaScript MIME type. The files are generated, not
 * committed.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.join(path.dirname(require.resolve("maplibre-gl/package.json")), "dist");
const dest = path.join(process.cwd(), "public", "vendor");
await mkdir(dest, { recursive: true });

const worker = await readFile(path.join(dist, "maplibre-gl-worker.mjs"), "utf8");
const rewritten = worker
  .replace('from"./maplibre-gl-shared.mjs"', 'from"./maplibre-gl-shared.js"')
  .replace(/\n\/\/# sourceMappingURL=.*$/u, "\n");
if (!rewritten.includes('from"./maplibre-gl-shared.js"')) {
  throw new Error("MapLibre worker import could not be rewritten");
}
await writeFile(path.join(dest, "maplibre-gl-worker.js"), rewritten);
await copyFile(path.join(dist, "maplibre-gl-shared.mjs"), path.join(dest, "maplibre-gl-shared.js"));
