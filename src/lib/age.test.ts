import { describe, expect, it } from "vitest";
import { classifyBracket, pickCategoryBracket } from "./age";
import { passes } from "./data";

const pass = (id: string) => {
  const found = passes.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("classifyBracket", () => {
  it("maps the tariff words used in the Austria file", () => {
    expect(classifyBracket("adult (age at purchase)")).toBe("adult");
    expect(classifyBracket("Erwachsene (–1997)")).toBe("adult");
    expect(classifyBracket("Erw. (–2000)")).toBe("adult");
    expect(classifyBracket("U25/Student (2001–2007)")).toBe("young-adult");
    expect(classifyBracket("U28 (1998–2007)")).toBe("young-adult");
    expect(classifyBracket("Jugend (2008–2010)")).toBe("youth");
    expect(classifyBracket("Kinder (2011–2020)")).toBe("child");
    expect(classifyBracket("Schüler I (2011–2015)")).toBe("child");
    expect(classifyBracket("Senioren (1953–1962)")).toBe("senior");
    expect(classifyBracket("Ermäßigte (Senioren) (–1962)")).toBe("senior");
    expect(classifyBracket("Ermäßigte (U25) (2001–2007)")).toBe("young-adult");
  });
});

describe("pickCategoryBracket", () => {
  it("picks the single adult tariff and refuses an ambiguous child group", () => {
    const bep = pass("noe-bergerlebnispass");
    expect(pickCategoryBracket(bep, "adult")?.label.startsWith("adult")).toBe(true);
    expect(pickCategoryBracket(bep, "youth")).toBeNull();

    const arlberg = pass("ski-arlberg-saisonkarte");
    expect(pickCategoryBracket(arlberg, "adult")?.label.startsWith("Erwachsene")).toBe(true);
    expect(pickCategoryBracket(arlberg, "child")?.label.startsWith("Kinder")).toBe(true);
    expect(pickCategoryBracket(pass("3taelerpass-saisonkarte"), "child")).toBeNull();
  });
});
