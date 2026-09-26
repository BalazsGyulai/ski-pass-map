import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGS } from "./languages";
import status from "./status.json";

const PLACEHOLDER = /\{[a-zA-Z]+\}/g;

function messageDir() {
  return path.join(import.meta.dirname, "messages");
}

describe("i18n message files", () => {
  const en = JSON.parse(fs.readFileSync(path.join(messageDir(), "en.json"), "utf8")) as Record<string, string>;
  const enKeys = Object.keys(en).sort();

  it("lists a status for every language", () => {
    for (const lang of LANGS) {
      expect(status[lang as keyof typeof status], lang).toBeTruthy();
    }
  });

  for (const lang of LANGS) {
    it(`${lang}.json matches English keys and placeholders`, () => {
      const file = path.join(messageDir(), `${lang}.json`);
      expect(fs.existsSync(file), `${lang}.json missing`).toBe(true);
      const loc = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, string>;
      expect(Object.keys(loc).sort()).toEqual(enKeys);
      for (const key of enKeys) {
        const a = (en[key].match(PLACEHOLDER) ?? []).sort().join(",");
        const b = (loc[key].match(PLACEHOLDER) ?? []).sort().join(",");
        expect(b, `${lang}.${key}`).toBe(a);
      }
    });
  }
});
