import type { Lang } from "./languages";

/**
 * How each language writes numbers, euro prices and dates, frozen from CLDR 48 (German as in
 * Austria, English as in Britain, Portuguese as in Portugal). Pages are pre-rendered at build
 * time and then hydrated, so both sides must print exactly the same text. Live Intl output
 * differs from browser to browser (each ships its own CLDR version, and Chrome has no Irish or
 * Maltese data at all), which broke hydration and showed English dates on Irish pages.
 */
export interface LocaleFormat {
  decimal: string;
  group: string;
  /** 2: four-digit numbers stay whole (1429, but 12 345). */
  minGroup?: 2;
  /** Minus sign, when it is not a hyphen. */
  minus?: string;
  /** Price pattern; # is the amount. */
  euro: string;
  /** Thousands separator in prices, where it differs from plain numbers (Austria: € 1.429 but 12 345). */
  euroGroup?: string;
  /** {d} / {dd} day, {M} / {MM} / {MMM} month, {y} year; everything else is literal. */
  date: string;
  /** Short month names as written after a day, for {MMM}. */
  months?: readonly string[];
}

export const LOCALE_FORMATS: Record<Lang, LocaleFormat> = {
  bg: { decimal: ",", group: "\u00a0", minGroup: 2, euro: "#\u00a0€", date: "{d}.{MM}.{y} г." },
  cs: { decimal: ",", group: "\u00a0", euro: "#\u00a0€", date: "{d}. {M}. {y}" },
  da: {
    decimal: ",", group: ".", euro: "#\u00a0€", date: "{d}. {MMM} {y}",
    months: ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."],
  },
  de: {
    decimal: ",", group: "\u00a0", euro: "€\u00a0#", euroGroup: ".", date: "{d}. {MMM} {y}",
    months: ["Jän.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."],
  },
  el: {
    decimal: ",", group: ".", euro: "#\u00a0€", date: "{d} {MMM} {y}",
    months: ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"],
  },
  en: {
    decimal: ".", group: ",", euro: "€#", date: "{d} {MMM} {y}",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"],
  },
  es: {
    decimal: ",", group: ".", minGroup: 2, euro: "#\u00a0€", date: "{d} {MMM} {y}",
    months: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"],
  },
  et: {
    decimal: ",", group: "\u00a0", minGroup: 2, minus: "\u2212", euro: "#\u00a0€", date: "{d}. {MMM} {y}",
    months: ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"],
  },
  fi: { decimal: ",", group: "\u00a0", minus: "\u2212", euro: "#\u00a0€", date: "{d}.{M}.{y}" },
  fr: {
    decimal: ",", group: "\u202f", euro: "#\u00a0€", date: "{d} {MMM} {y}",
    months: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
  },
  ga: {
    decimal: ".", group: ",", euro: "€#", date: "{d} {MMM} {y}",
    months: ["Ean", "Feabh", "Márta", "Aib", "Beal", "Meith", "Iúil", "Lún", "MFómh", "DFómh", "Samh", "Noll"],
  },
  hr: {
    decimal: ",", group: ".", minus: "\u2212", euro: "#\u00a0€", date: "{d}. {MMM} {y}.",
    months: ["sij", "velj", "ožu", "tra", "svi", "lip", "srp", "kol", "ruj", "lis", "stu", "pro"],
  },
  hu: {
    decimal: ",", group: "\u00a0", minGroup: 2, euro: "#\u00a0EUR", date: "{y}. {MMM} {d}.",
    months: ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."],
  },
  it: {
    decimal: ",", group: ".", minGroup: 2, euro: "#\u00a0€", date: "{d} {MMM} {y}",
    months: ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"],
  },
  lt: { decimal: ",", group: "\u00a0", minus: "\u2212", euro: "#\u00a0€", date: "{y}-{MM}-{dd}" },
  lv: {
    decimal: ",", group: "\u00a0", minGroup: 2, euro: "#\u00a0€", date: "{y}. g. {d}. {MMM}",
    months: ["janv.", "febr.", "marts", "apr.", "maijs", "jūn.", "jūl.", "aug.", "sept.", "okt.", "nov.", "dec."],
  },
  mt: {
    decimal: ".", group: ",", euro: "€#", date: "{d} ta\u2019 {MMM}, {y}",
    months: ["Jan", "Fra", "Mar", "Apr", "Mej", "Ġun", "Lul", "Aww", "Set", "Ott", "Nov", "Diċ"],
  },
  nb: {
    decimal: ",", group: "\u00a0", minus: "\u2212", euro: "#\u00a0€", date: "{d}. {MMM} {y}",
    months: ["jan.", "feb.", "mars", "apr.", "mai", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "des."],
  },
  nl: {
    decimal: ",", group: ".", euro: "€\u00a0#", date: "{d} {MMM} {y}",
    months: ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"],
  },
  pl: {
    decimal: ",", group: "\u00a0", minGroup: 2, euro: "#\u00a0€", date: "{d} {MMM} {y}",
    months: ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"],
  },
  pt: { decimal: ",", group: "\u00a0", minGroup: 2, euro: "#\u00a0€", date: "{d}/{MM}/{y}" },
  ro: {
    decimal: ",", group: ".", euro: "#\u00a0EUR", date: "{d} {MMM} {y}",
    months: ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."],
  },
  sk: { decimal: ",", group: "\u00a0", euro: "#\u00a0€", date: "{d}. {M}. {y}" },
  sl: {
    decimal: ",", group: ".", minGroup: 2, minus: "\u2212", euro: "#\u00a0€", date: "{d}. {MMM} {y}",
    months: ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "avg.", "sep.", "okt.", "nov.", "dec."],
  },
  sv: {
    decimal: ",", group: "\u00a0", minus: "\u2212", euro: "#\u00a0€", date: "{d} {MMM} {y}",
    months: ["jan.", "feb.", "mars", "apr.", "maj", "juni", "juli", "aug.", "sep.", "okt.", "nov.", "dec."],
  },
  ca: {
    decimal: ",", group: ".", euro: "#\u00a0€", date: "{d} {MMM} del {y}",
    months: ["de gen.", "de febr.", "de març", "d\u2019abr.", "de maig", "de juny", "de jul.", "d\u2019ag.", "de set.", "d\u2019oct.", "de nov.", "de des."],
  },
};
