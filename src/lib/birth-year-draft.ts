/** Years the passes actually price. A half-typed year is not one of these yet. */
export const BIRTH_YEAR_MIN = 1920;

/** The latest birth year is the calendar year the visitor is in. Local time, so New Year's Day is already the new year. */
export function birthYearMax(now: Date = new Date()): number {
  return now.getFullYear();
}

/** Keep a stored year inside the range. A later year becomes this calendar year. */
export function clampBirthYear(year: number, maxYear: number = birthYearMax()): number {
  return Math.min(maxYear, Math.max(BIRTH_YEAR_MIN, year));
}

export interface BirthYearDraft {
  /** What the field should show. */
  draft: string;
  /** A year to save, null to clear, or omitted while the year is still unfinished. */
  year?: number | null;
}

/** Keep up to four digits. Save a finished year in range. A later year is capped at maxYear. Clear when the field is empty. */
export function nextBirthYearDraft(raw: string, maxYear: number = birthYearMax()): BirthYearDraft {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits === "") return { draft: "", year: null };
  if (digits.length < 4) return { draft: digits };
  const year = Number(digits);
  if (year > maxYear) return { draft: String(maxYear), year: maxYear };
  if (year >= BIRTH_YEAR_MIN) return { draft: digits, year };
  return { draft: digits };
}
