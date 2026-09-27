import en from "@/i18n/messages/en.json";
import { formatDate } from "./format";
import type { Lang } from "@/i18n/languages";
import type { PriceReason } from "./pricing";

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

const regionKeys: Record<string, MessageKey> = {
  "Lower Austria": "regionLowerAustria",
  Styria: "regionStyria",
  "Styria / Carinthia": "regionStyriaCarinthia",
  Tirol: "regionTirol",
  Hungary: "regionHungary",
  Vienna: "regionVienna",
  Burgenland: "regionBurgenland",
  Carinthia: "regionCarinthia",
  Salzburg: "regionSalzburg",
  "Upper Austria": "regionUpperAustria",
  Vorarlberg: "regionVorarlberg",
  Bavaria: "regionBavaria",
};

const bracketKeys: Record<string, MessageKey> = {
  adult: "bracketAdult",
  u25: "bracketU25",
  u28: "bracketU28",
  child: "bracketChild",
  standard: "bracketStandard",
};

const deadlineKeys: Record<string, MessageKey> = {
  "bep-early": "deadlineBepEarly",
  "bep-november": "deadlineBepNovember",
  "tsc-start": "deadlineTscStart",
  "tsc-end": "deadlineTscEnd",
  "sj-early": "deadlineSjEarly",
  "ssc-early": "deadlineSscEarly",
  "mmt-u28": "deadlineMmtU28",
};

export function translate(messages: Messages, key: MessageKey, vars?: Record<string, string | number>): string {
  let text = messages[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

const countryKeys: Record<string, MessageKey> = {
  AT: "countryAT",
  DE: "countryDE",
  HU: "countryHU",
  IT: "countryIT",
  CH: "countryCH",
  SI: "countrySI",
};

export function countryLabel(messages: Messages, code: string): string {
  const key = countryKeys[code];
  return key ? translate(messages, key) : code;
}

export function regionLabel(messages: Messages, region: string): string {
  return region
    .split(" / ")
    .map((part) => {
      const key = regionKeys[part];
      return key ? translate(messages, key) : part;
    })
    .join(" / ");
}

export function bracketLabel(messages: Messages, id: string, fallback: string): string {
  const key = bracketKeys[id] ?? bracketKeys[id.toLowerCase()];
  return key ? translate(messages, key) : fallback;
}

export function deadlineLabel(messages: Messages, id: string, fallback: string): string {
  const key = deadlineKeys[id];
  return key ? translate(messages, key) : fallback;
}

export function priceReasonText(
  messages: Messages,
  lang: Lang,
  reason: PriceReason | null,
  bracketId: string | null,
  nextStart: string | null,
): string {
  if (bracketId === "child") return translate(messages, "childUnknown");
  if (reason === "no-birth-year") return translate(messages, "noBirthYear");
  if (reason === "age-not-birth-year") return translate(messages, "ageNotBirthYear");
  if (reason === "no-bracket") return translate(messages, "noBracket");
  if (reason === "no-period") {
    return nextStart ? translate(messages, "presaleNotStarted", { date: formatDate(lang, nextStart) }) : translate(messages, "priceUnknown");
  }
  if (reason === "price-unknown") return translate(messages, "afterDeadline");
  return translate(messages, "priceUnknown");
}
