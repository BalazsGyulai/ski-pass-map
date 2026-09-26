import { fold } from "./filter";
import type { AgeBracket, Pass } from "./schema";

/** Coarse price group used when no birth year is set. A birth year still wins. */
export type AgeCategory = "adult" | "young-adult" | "youth" | "child";

export const AGE_CATEGORIES: AgeCategory[] = ["adult", "young-adult", "youth", "child"];

export function isAgeCategory(value: string | null | undefined): value is AgeCategory {
  return value === "adult" || value === "young-adult" || value === "youth" || value === "child";
}

function loose(label: string): string {
  return fold(label).replaceAll("ß", "ss");
}

/** Which price group a tariff label belongs to. Senior tariffs are not a group in the selector. */
export function classifyBracket(label: string): AgeCategory | "senior" | "other" {
  const text = loose(label);
  if (text.includes("senior")) return "senior";
  if (/schneemann|murmele|kleinkind|schuler|\bkind|\bchild\b/.test(text)) return "child";
  if (text.includes("jugend") || text.includes("youth")) return "youth";
  if (/\bu2\d\b|student|ermassigt|young/.test(text)) return "young-adult";
  if (/erwachsen|adult|\berw\b/.test(text)) return "adult";
  return "other";
}

function rank(label: string, category: AgeCategory): number {
  const text = loose(label);
  if (category === "adult") return /^erwachsen|^adult/.test(text) ? 0 : 1;
  if (category === "young-adult") {
    if (text.includes("u25")) return 0;
    if (text.includes("u28")) return 1;
    if (text.includes("u23")) return 2;
    return 3;
  }
  if (category === "youth") return /^jugend/.test(text) ? 0 : 1;
  return /^kinder|^kind\b/.test(text) ? 0 : 2;
}

/**
 * The tariff for a price group.
 * Returns null when the pass has no such tariff, or more than one equally specific tariff.
 * Callers should ask for a birth year instead of guessing.
 */
export function pickCategoryBracket(pass: Pass, category: AgeCategory): AgeBracket | null {
  const matches = pass.pricing.brackets.filter((bracket) => classifyBracket(bracket.label) === category);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const ranked = matches
    .map((bracket) => ({ bracket, rank: rank(bracket.label, category) }))
    .sort((a, b) => a.rank - b.rank || a.bracket.label.length - b.bracket.label.length);
  if (ranked[0].rank < ranked[1].rank) return ranked[0].bracket;
  return null;
}
