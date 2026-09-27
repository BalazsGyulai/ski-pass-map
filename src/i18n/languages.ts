/** Supported UI languages (24 EU official + Norwegian Bokmål + Catalan). */
export const LANGS = [
  "bg",
  "cs",
  "da",
  "de",
  "el",
  "en",
  "es",
  "et",
  "fi",
  "fr",
  "ga",
  "hr",
  "hu",
  "it",
  "lt",
  "lv",
  "mt",
  "nb",
  "nl",
  "pl",
  "pt",
  "ro",
  "sk",
  "sl",
  "sv",
  "ca",
] as const;

export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";

export const LANG_STORAGE_KEY = "skimap-lang";

/** Endonym for the language switcher. */
export const LANG_NATIVE: Record<Lang, string> = {
  bg: "Български",
  cs: "Čeština",
  da: "Dansk",
  de: "Deutsch",
  el: "Ελληνικά",
  en: "English",
  es: "Español",
  et: "Eesti",
  fi: "Suomi",
  fr: "Français",
  ga: "Gaeilge",
  hr: "Hrvatski",
  hu: "Magyar",
  it: "Italiano",
  lt: "Lietuvių",
  lv: "Latviešu",
  mt: "Malti",
  nb: "Norsk",
  nl: "Nederlands",
  pl: "Polski",
  pt: "Português",
  ro: "Română",
  sk: "Sločina",
  sl: "Slovenščina",
  sv: "Svenska",
  ca: "Català",
};

const INTL_LOCALE: Record<Lang, string> = {
  bg: "bg-BG",
  cs: "cs-CZ",
  da: "da-DK",
  de: "de-AT",
  el: "el-GR",
  en: "en-GB",
  es: "es-ES",
  et: "et-EE",
  fi: "fi-FI",
  fr: "fr-FR",
  ga: "ga-IE",
  hr: "hr-HR",
  hu: "hu-HU",
  it: "it-IT",
  lt: "lt-LT",
  lv: "lv-LV",
  mt: "mt-MT",
  nb: "nb-NO",
  nl: "nl-NL",
  pl: "pl-PL",
  pt: "pt-PT",
  ro: "ro-RO",
  sk: "sk-SK",
  sl: "sl-SI",
  sv: "sv-SE",
  ca: "ca-ES",
};

export function isLang(value: string): value is Lang {
  return (LANGS as readonly string[]).includes(value);
}

export function intlLocale(lang: Lang): string {
  return INTL_LOCALE[lang];
}

/** Map a BCP 47 tag from the browser to a supported Lang, or null. */
export function langFromAcceptLanguage(tag: string): Lang | null {
  const base = tag.trim().toLowerCase().split("-")[0];
  if (base === "no" || tag.toLowerCase().startsWith("nb") || tag.toLowerCase().startsWith("nn")) return "nb";
  if (isLang(base)) return base;
  if (base === "ca") return "ca";
  return null;
}

export function detectClientLang(): Lang {
  if (typeof window === "undefined") return DEFAULT_LANG;
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && isLang(saved)) return saved;
  } catch {
    /* private mode */
  }
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    if (!tag) continue;
    const match = langFromAcceptLanguage(tag);
    if (match) return match;
  }
  return DEFAULT_LANG;
}

export function persistLangChoice(lang: Lang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}
