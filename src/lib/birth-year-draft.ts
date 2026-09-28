/** Years the passes actually price. A half-typed year is not one of these yet. */
export const BIRTH_YEAR_MIN = 1920;
export const BIRTH_YEAR_MAX = 2026;

export interface BirthYearDraft {
  /** What the field should show. */
  draft: string;
  /** A year to save, null to clear, or omitted while the year is still unfinished. */
  year?: number | null;
}

/** Keep up to four digits. Save only a finished year in range, and clear when the field is empty. */
export function nextBirthYearDraft(raw: string): BirthYearDraft {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits === "") return { draft: "", year: null };
  if (digits.length < 4) return { draft: digits };
  const year = Number(digits);
  if (year >= BIRTH_YEAR_MIN && year <= BIRTH_YEAR_MAX) return { draft: digits, year };
  return { draft: digits };
}
