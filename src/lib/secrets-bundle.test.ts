import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SECRET_NAMES = [
  "TURNSTILE_SECRET_KEY",
  "MAP_LOAD_HASH_SALT",
  "ACCESS_AUD",
  "ADMIN_DEV_BYPASS",
];

describe("client bundle secrets", () => {
  it("does not ship secret env names in out/", () => {
    const outDir = path.join(process.cwd(), "out");
    if (!fs.existsSync(outDir)) {
      expect(true).toBe(true);
      return;
    }
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(js|html|json|css)$/.test(entry.name)) files.push(full);
      }
    };
    walk(outDir);
    const combined = files.map((f) => fs.readFileSync(f, "utf8")).join("\n");
    for (const name of SECRET_NAMES) {
      expect(combined.includes(name), `found ${name} in out/`).toBe(false);
    }
  });
});
