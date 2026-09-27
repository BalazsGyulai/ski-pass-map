import fs from "node:fs";
import path from "node:path";

const dir = path.join(import.meta.dirname, "../src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8"));
const keys = [
  "contactIntro",
  "contactCategoryLabel",
  "contactCategoryGeneral",
  "contactCategoryDataError",
  "contactCategoryResortOwner",
  "contactCategoryPrivacy",
  "contactCategoryOther",
  "contactEmailLabel",
  "contactEmailHint",
  "contactResortIdLabel",
  "contactResortIdHint",
  "contactMessageLabel",
  "contactMessagePlaceholder",
  "contactPrivacyConsent",
  "contactSubmit",
  "contactSending",
  "contactSuccess",
  "contactFailure",
  "contactRateLimited",
  "contactTurnstileError",
  "contactValidationError",
];

const hu = {
  contactIntro:
    "Üzenetet küldhetsz a térképről, az adatokról vagy az adatvédelmi jogaidról. Nincs szükség fiókra. A rendszer nem küld e-mailt; az üzeneteket ellenőrzésre tároljuk.",
  contactCategoryLabel: "Téma",
  contactCategoryGeneral: "Általános kérdés",
  contactCategoryDataError: "Hibás vagy hiányzó adat",
  contactCategoryResortOwner: "Síterep vagy bérlet üzemeltető",
  contactCategoryPrivacy: "Adatvédelmi kérelem",
  contactCategoryOther: "Egyéb",
  contactEmailLabel: "E-mail",
  contactEmailHint: "Nem kötelező. Csak akkor használjuk, ha válaszolni kell.",
  contactResortIdLabel: "Síterep azonosító",
  contactResortIdHint: "Nem kötelező. A síterep lapján vagy az adatfájlban található id.",
  contactMessageLabel: "Üzenet",
  contactMessagePlaceholder: "Írd le a kérdést vagy a javítást.",
  contactPrivacyConsent: "Elolvastam az adatvédelmi tájékoztatót.",
  contactSubmit: "Üzenet küldése",
  contactSending: "Küldés…",
  contactSuccess: "Köszönjük. Megkaptuk az üzenetet.",
  contactFailure: "Az üzenetet nem sikerült elküldeni. Próbáld újra később.",
  contactRateLimited: "Túl sok üzenet erről a kapcsolatról. Próbáld újra egy óra múlva.",
  contactTurnstileError: "A biztonsági ellenőrzés nem sikerült. Frissítsd az oldalt, majd próbáld újra.",
  contactValidationError: "Ellenőrizd a mezőket, majd próbáld újra.",
};

const de = {
  contactIntro:
    "Schreib uns zur Karte, zu den Daten oder zu deinen Datenschutzrechten. Kein Konto nötig. Dieses Formular versendet keine E-Mail; Nachrichten werden zur Prüfung gespeichert.",
  contactCategoryLabel: "Thema",
  contactCategoryGeneral: "Allgemeine Frage",
  contactCategoryDataError: "Falsche oder fehlende Daten",
  contactCategoryResortOwner: "Skigebiet oder Pass-Betreiber",
  contactCategoryPrivacy: "Datenschutzanfrage",
  contactCategoryOther: "Sonstiges",
  contactEmailLabel: "E-Mail",
  contactEmailHint: "Optional. Nur wenn wir antworten müssen.",
  contactResortIdLabel: "Skigebiet-ID",
  contactResortIdHint: "Optional. Die ID aus der Karte oder der Datendatei.",
  contactMessageLabel: "Nachricht",
  contactMessagePlaceholder: "Beschreibe deine Frage oder Korrektur.",
  contactPrivacyConsent: "Ich habe die Datenschutzhinweise gelesen.",
  contactSubmit: "Nachricht senden",
  contactSending: "Senden…",
  contactSuccess: "Danke. Deine Nachricht ist eingegangen.",
  contactFailure: "Die Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.",
  contactRateLimited: "Zu viele Nachrichten von dieser Verbindung. Bitte in einer Stunde erneut versuchen.",
  contactTurnstileError: "Sicherheitsprüfung fehlgeschlagen. Seite neu laden und erneut versuchen.",
  contactValidationError: "Bitte Felder prüfen und erneut versuchen.",
};

const langs = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json");

for (const file of langs) {
  const lang = file.replace(".json", "");
  const loc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  for (const key of keys) {
    if (lang === "hu") loc[key] = hu[key];
    else if (lang === "de") loc[key] = de[key];
    else loc[key] = en[key];
  }
  fs.writeFileSync(path.join(dir, file), `${JSON.stringify(loc, null, 2)}\n`);
}
