import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const outDir = path.join(import.meta.dirname, "../../out");

describe.skipIf(!existsSync(path.join(outDir, "hu/index.html")))("static export html lang", () => {
  it("sets lang on Hungarian and German map index pages", () => {
    const hu = readFileSync(path.join(outDir, "hu/index.html"), "utf8");
    const de = readFileSync(path.join(outDir, "de/index.html"), "utf8");
    expect(hu).toMatch(/<html[^>]*\blang="hu"/);
    expect(de).toMatch(/<html[^>]*\blang="de"/);
  });
});
