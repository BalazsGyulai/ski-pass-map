import { readFileSync } from "node:fs";

const checks = [
  { file: "out/hu/index.html", lang: "hu" },
  { file: "out/de/index.html", lang: "de" },
];

for (const { file, lang } of checks) {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const pattern = new RegExp(`<html[^>]*\\blang="${lang}"`);
  if (!pattern.test(html)) {
    console.error(`Expected ${file} to contain <html lang="${lang}"> in static markup.`);
    process.exit(1);
  }
}

console.log("Static HTML lang attributes OK (hu, de).");
