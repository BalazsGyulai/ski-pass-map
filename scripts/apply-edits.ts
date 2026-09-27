#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { applyPatchToCatalog, type DataPatchFile } from "../src/lib/admin/edits";
import { execSync } from "node:child_process";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run apply:edits <patch.json>");
  process.exit(1);
}
const patch = JSON.parse(fs.readFileSync(file, "utf8")) as DataPatchFile;
const targetPath = path.join(process.cwd(), patch.targetFile);
const catalog = JSON.parse(fs.readFileSync(targetPath, "utf8")) as { resorts?: unknown[]; passes?: unknown[] };
const next = applyPatchToCatalog(catalog, patch);
const merged = { ...catalog, ...next };
fs.writeFileSync(targetPath, `${JSON.stringify(merged, null, 2)}\n`);
execSync("npm run validate", { stdio: "inherit" });
console.log(`Applied patch to ${patch.targetFile} for ${patch.entityId}`);
