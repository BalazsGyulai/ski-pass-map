import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const langs = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json");

const hu = {
  legalDraftBanner: "DRAFT – tulajdonosi felülvizsgálat alatt",
  legalFallbackNote: "A jogi szöveg angolul és magyarul érhető el.",
  legalCrosslinks: "Jogi oldalak",
  cookieSettings: "Süti beállítások",
  consentBannerBody: "Eszközön tároljuk a kedvenceket, a tervet, a nyelvet, a témát és opcionálisan a Mapbox térképet. Bármikor módosítható.",
  consentAccept: "Elfogadom",
  consentReject: "Elutasítom",
  consentSettings: "Beállítások",
  consentSave: "Mentés",
  consentNecessaryTitle: "Szigorúan szükséges",
  consentNecessaryBody: "Ezekhez nem kérünk hozzájárulást:",
  consentMapCategory: "Térképszolgáltató (Mapbox)",
  consentMapCategoryDesc: "Mapbox csempéket tölt be, és technikai adatot tárolhat az eszközön, ha ezt választja az OpenFreeMap helyett.",
  resetSupportReminders: "Támogatási emlékeztetők törlése",
  rankingTitle: "Hogyan soroljuk a síterepeket",
  supportPromptHeadline: "A Skimap ingyenes. Kevesebb emlékeztetőt szeretne?",
  supportPromptKofi: "Támogatás Ko-fión",
  supportPromptNotNow: "Most nem",
  supportPromptRewarded: "Rövid reklám – 2 napig nincs emlékeztető",
  supportCodeEnter: "Támogatói kód megadása",
  supportCodePrompt: "Illessze be a Ko-fi perk kódot",
  affiliatePartnerLinks: "Partner linkek",
  affiliateAdLabel: "Hirdetés / Affiliate link",
  affiliateDisclosure: "Ezek a linkek jutalékot hozhatnak. Nem befolyásolják a térképi sorrendet.",
  resortSheetTabs: "Síterep részek",
  resortTabOverview: "Áttekintés",
  resortTabLinks: "Linkek",
};

const de = {
  legalDraftBanner: "ENTWURF – ausstehende Prüfung durch den Betreiber",
  legalFallbackNote: "Rechtstexte auf Englisch und Ungarisch verfügbar.",
  legalCrosslinks: "Rechtliche Seiten",
  cookieSettings: "Cookie-Einstellungen",
  consentBannerBody: "Wir speichern Favoriten, Plan, Sprache, Darstellung und optional Mapbox-Karten lokal. Sie können dies jederzeit ändern.",
  consentAccept: "Akzeptieren",
  consentReject: "Ablehnen",
  consentSettings: "Einstellungen",
  consentSave: "Speichern",
  consentNecessaryTitle: "Unbedingt erforderlich",
  consentNecessaryBody: "Diese Speicherung ist ohne Einwilligung:",
  consentMapCategory: "Kartenanbieter (Mapbox)",
  consentMapCategoryDesc: "Lädt Mapbox-Karten und kann technische Daten speichern, wenn Sie dies statt OpenFreeMap wählen.",
  resetSupportReminders: "Support-Erinnerungen zurücksetzen",
  rankingTitle: "Sortierung der Skigebiete",
  supportPromptHeadline: "Skimap ist kostenlos. Weniger Erinnerungen?",
  supportPromptKofi: "Auf Ko-fi unterstützen",
  supportPromptNotNow: "Nicht jetzt",
  supportPromptRewarded: "Kurze Anzeige – 2 Tage keine Erinnerungen",
  supportCodeEnter: "Supporter-Code eingeben",
  supportCodePrompt: "Code aus der Ko-fi-E-Mail einfügen",
  affiliatePartnerLinks: "Partnerlinks",
  affiliateAdLabel: "Anzeige / Affiliate-Link",
  affiliateDisclosure: "Diese Links können Provision bringen. Sie ändern die Kartenreihenfolge nicht.",
  resortSheetTabs: "Skigebiet-Bereiche",
  resortTabOverview: "Übersicht",
  resortTabLinks: "Links",
};

for (const file of langs) {
  const lang = file.replace(".json", "");
  const locPath = path.join(dir, file);
  const loc = JSON.parse(fs.readFileSync(locPath, "utf8"));
  for (const key of Object.keys(en)) {
    if (loc[key] === undefined) {
      if (lang === "hu" && hu[key]) loc[key] = hu[key];
      else if (lang === "de" && de[key]) loc[key] = de[key];
      else loc[key] = en[key];
    }
  }
  const sorted = Object.fromEntries(Object.keys(en).map((k) => [k, loc[k] ?? en[k]]));
  fs.writeFileSync(locPath, `${JSON.stringify(sorted, null, 2)}\n`);
}
console.log("synced", langs.length, "locale files");
