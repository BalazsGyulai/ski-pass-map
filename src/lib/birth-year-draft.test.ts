import { describe, expect, it } from "vitest";
import { birthYearMax, clampBirthYear, nextBirthYearDraft } from "./birth-year-draft";

describe("birth year limits", () => {
  it("uses the calendar year as the latest birth year", () => {
    expect(birthYearMax(new Date(2026, 11, 31))).toBe(2026);
    expect(birthYearMax(new Date(2027, 0, 1))).toBe(2027);
  });

  it("caps a finished year at the given calendar year", () => {
    expect(nextBirthYearDraft("2026", 2026)).toEqual({ draft: "2026", year: 2026 });
    expect(nextBirthYearDraft("2027", 2026)).toEqual({ draft: "2026", year: 2026 });
    expect(nextBirthYearDraft("2099", 2026)).toEqual({ draft: "2026", year: 2026 });
    expect(nextBirthYearDraft("2027", 2027)).toEqual({ draft: "2027", year: 2027 });
    expect(clampBirthYear(2030, 2026)).toBe(2026);
    expect(clampBirthYear(2027, 2027)).toBe(2027);
    expect(clampBirthYear(1990, 2026)).toBe(1990);
  });
});

describe("nextBirthYearDraft", () => {
  it("keeps a partial year on screen and does not save it", () => {
    expect(nextBirthYearDraft("2", 2026)).toEqual({ draft: "2" });
    expect(nextBirthYearDraft("20", 2026)).toEqual({ draft: "20" });
    expect(nextBirthYearDraft("200", 2026)).toEqual({ draft: "200" });
  });

  it("saves a finished year in range and clears an empty field", () => {
    expect(nextBirthYearDraft("2005", 2026)).toEqual({ draft: "2005", year: 2005 });
    expect(nextBirthYearDraft("1920", 2026)).toEqual({ draft: "1920", year: 1920 });
    expect(nextBirthYearDraft("")).toEqual({ draft: "", year: null });
  });

  it("shows a year before 1920 without saving it", () => {
    expect(nextBirthYearDraft("1800", 2026)).toEqual({ draft: "1800" });
    expect(nextBirthYearDraft("20a05", 2026)).toEqual({ draft: "2005", year: 2005 });
  });
});
