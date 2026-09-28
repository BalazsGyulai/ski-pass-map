import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALE_FORMATS } from "@/i18n/formats";
import { LANGS } from "@/i18n/languages";
import { formatDate, formatEur, formatKm, formatNumber, formatSeasonLabel, formatSeasonRange } from "./format";

const NBSP = " ";
const NNBSP = " ";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatEur", () => {
  it("writes prices the way each language does", () => {
    expect(formatEur("en", 1429)).toBe("€1,429");
    expect(formatEur("en", 59.5)).toBe("€59.50");
    expect(formatEur("de", 1429)).toBe(`€${NBSP}1.429`);
    expect(formatEur("fr", 1429)).toBe(`1${NNBSP}429${NBSP}€`);
    expect(formatEur("nl", 429)).toBe(`€${NBSP}429`);
    expect(formatEur("hu", 12345)).toBe(`12${NBSP}345${NBSP}EUR`);
    expect(formatEur("ga", 1429)).toBe("€1,429");
  });

  it("keeps four-digit amounts whole where the language does", () => {
    expect(formatEur("it", 1429)).toBe(`1429${NBSP}€`);
    expect(formatEur("it", 12345)).toBe(`12.345${NBSP}€`);
    expect(formatEur("es", 1429)).toBe(`1429${NBSP}€`);
    expect(formatEur("da", 1429)).toBe(`1.429${NBSP}€`);
  });

  it("shows cents only when there are some, and a local minus sign", () => {
    expect(formatEur("de", 42.0004)).toBe(`€${NBSP}42`);
    expect(formatEur("de", 42.5)).toBe(`€${NBSP}42,50`);
    expect(formatEur("en", -5)).toBe("-€5");
    expect(formatEur("sv", -5)).toBe(`−5${NBSP}€`);
    expect(formatEur("en", Number.NaN)).toBe("");
  });
});

describe("formatDate", () => {
  it("uses each language's order and short month names", () => {
    expect(formatDate("en", "2026-10-31")).toBe("31 Oct 2026");
    expect(formatDate("de", "2026-01-05")).toBe("5. Jän. 2026");
    expect(formatDate("hu", "2026-10-31")).toBe("2026. okt. 31.");
    expect(formatDate("lv", "2026-10-31")).toBe("2026. g. 31. okt.");
    expect(formatDate("bg", "2026-10-31")).toBe("31.10.2026 г.");
    expect(formatDate("fi", "2026-10-31")).toBe("31.10.2026");
    expect(formatDate("pt", "2026-01-05")).toBe("5/01/2026");
    expect(formatDate("lt", "2026-01-05")).toBe("2026-01-05");
    expect(formatDate("ca", "2026-10-31")).toBe("31 d’oct. del 2026");
    expect(formatDate("ca", "2026-01-05")).toBe("5 de gen. del 2026");
  });

  it("writes Irish and Maltese dates even where the browser has no data for them", () => {
    expect(formatDate("ga", "2026-10-31")).toBe("31 DFómh 2026");
    expect(formatDate("mt", "2026-10-31")).toBe("31 ta’ Ott, 2026");
  });

  it("accepts a month or a year alone and leaves other text as it is", () => {
    expect(formatDate("en", "2026-12")).toBe("1 Dec 2026");
    expect(formatDate("en", "2026")).toBe("1 Jan 2026");
    expect(formatDate("en", "soon")).toBe("soon");
  });
});

describe("formatSeasonRange", () => {
  it("formats a range, a single day, and leaves prose alone", () => {
    expect(formatSeasonRange("en", "2026-12-04 – 2027-03-07")).toEqual({ start: "4 Dec 2026", end: "7 Mar 2027" });
    expect(formatSeasonRange("de", "2026-12-04 – 2027-03-07")).toEqual({ start: "4. Dez. 2026", end: "7. März 2027" });
    expect(formatSeasonRange("en", "2026-12-05")).toEqual({ start: "5 Dec 2026", end: null });
    expect(formatSeasonRange("en", "varies by resort")).toBeNull();
    expect(formatSeasonLabel("en", "2026-12-04 – 2027-03-07")).toBe("4 Dec 2026 – 7 Mar 2027");
    expect(formatSeasonLabel("en", "varies by resort")).toBe("varies by resort");
  });
});

describe("formatNumber and formatKm", () => {
  it("uses the language's separators", () => {
    expect(formatNumber("de", 12345)).toBe(`12${NBSP}345`);
    expect(formatNumber("en", 1234567)).toBe("1,234,567");
    expect(formatNumber("pl", 1234)).toBe("1234");
    expect(formatNumber("en", 2.125)).toBe("2.125");
    expect(formatNumber("en", 2.1255)).toBe("2.126");
    expect(formatKm("fi", 8.44)).toBe("8,4");
    expect(formatKm("en", 12.6)).toBe("13");
    expect(formatKm("de", 1234.4)).toBe(`1${NBSP}234`);
    expect(formatNumber("en", -0.004, { maximumFractionDigits: 2 })).toBe("0");
  });
});

describe("locale formats", () => {
  it("covers every language completely", () => {
    for (const lang of LANGS) {
      const spec = LOCALE_FORMATS[lang];
      expect(spec.euro, lang).toContain("#");
      if (spec.date.includes("{MMM}")) expect(spec.months, lang).toHaveLength(12);
      for (let month = 1; month <= 12; month++) {
        const text = formatDate(lang, `2026-${String(month).padStart(2, "0")}-15`);
        expect(text, lang).toContain("2026");
        expect(text, lang).not.toMatch(/[{}]|undefined/);
      }
      expect(formatEur(lang, 1429.5), lang).toMatch(/1.?429.50/);
    }
  });

  it("never asks the runtime's Intl, so the build and every browser agree", () => {
    const refuse = () => {
      throw new Error("Intl used");
    };
    vi.spyOn(Intl, "NumberFormat").mockImplementation(refuse);
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(refuse);
    for (const lang of LANGS) {
      expect(() => [formatEur(lang, 1429.5), formatDate(lang, "2026-10-31"), formatKm(lang, 8.4), formatNumber(lang, 12345)]).not.toThrow();
    }
  });
});
