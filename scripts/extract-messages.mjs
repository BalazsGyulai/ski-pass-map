import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "src/lib/i18n.ts"), "utf8");

function extractBlock(name) {
  const re = new RegExp(`const ${name} = \\{([\\s\\S]*?)\\} as const;`);
  const match = source.match(re);
  if (!match) throw new Error(`Missing block ${name}`);
  const body = match[1];
  const entries = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s+(\w+):\s+"((?:\\.|[^"\\])*)",?\s*$/);
    if (!m) continue;
    entries[m[1]] = JSON.parse(`"${m[2]}"`);
  }
  return entries;
}

const en = extractBlock("en");
const hu = extractBlock("hu");
delete en.langEn;
delete en.langHu;
delete hu.langEn;
delete hu.langHu;
en.metaDescription =
  "Skimap.eu compares season passes and day tickets for ski areas in Austria for the 2026/27 season. No account, browser-only.";
hu.metaDescription =
  "A Skimap.eu az ausztriai síterepek szezonbérleteit és napijegyeit hasonlítja össze a 2026/27-es szezonra. Fiók nélkül, csak böngészőben.";

const outDir = path.join(root, "src/i18n/messages");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "en.json"), `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, "hu.json"), `${JSON.stringify(hu, null, 2)}\n`);
console.log(`Wrote en (${Object.keys(en).length}) and hu (${Object.keys(hu).length})`);
