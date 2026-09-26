import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
execSync("npx wrangler d1 migrations apply skimap-app --local", { stdio: "inherit", cwd: root });
