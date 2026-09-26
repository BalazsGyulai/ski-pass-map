import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "backup-local");
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
execSync(`npx wrangler d1 export skimap-map-loads --local --output=${path.join(outDir, `map-loads-${stamp}.sql`)}`, {
  stdio: "inherit",
});
execSync(`npx wrangler d1 export skimap-app --local --output=${path.join(outDir, `skimap-app-${stamp}.sql`)}`, {
  stdio: "inherit",
});
console.log("Wrote SQL dumps to", outDir);
