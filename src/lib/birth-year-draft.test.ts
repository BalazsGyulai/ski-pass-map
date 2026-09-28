import { describe, expect, it } from "vitest";
import { nextBirthYearDraft } from "./birth-year-draft";

describe("nextBirthYearDraft", () => {
  it("keeps a partial year on screen and does not save it", () => {
    expect(nextBirthYearDraft("2")).toEqual({ draft: "2" });
    expect(nextBirthYearDraft("20")).toEqual({ draft: "20" });
    expect(nextBirthYearDraft("200")).toEqual({ draft: "200" });
  });

  it("saves a finished year in range and clears an empty field", () => {
    expect(nextBirthYearDraft("2005")).toEqual({ draft: "2005", year: 2005 });
    expect(nextBirthYearDraft("1920")).toEqual({ draft: "1920", year: 1920 });
    expect(nextBirthYearDraft("2026")).toEqual({ draft: "2026", year: 2026 });
    expect(nextBirthYearDraft("")).toEqual({ draft: "", year: null });
  });

  it("shows an impossible year without saving it", () => {
    expect(nextBirthYearDraft("1800")).toEqual({ draft: "1800" });
    expect(nextBirthYearDraft("2099")).toEqual({ draft: "2099" });
    expect(nextBirthYearDraft("20a05")).toEqual({ draft: "2005", year: 2005 });
  });
});
