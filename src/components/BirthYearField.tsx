"use client";

import { useEffect, useRef, useState } from "react";
import { nextBirthYearDraft } from "@/lib/birth-year-draft";
import { useApp } from "./AppState";

/** Text field so a year can be deleted and retyped. A finished year is saved; a half-typed one is not. */
export function BirthYearInput({ placeholder }: { placeholder?: string }) {
  const { birthYear, setBirthYear } = useApp();
  const saved = birthYear == null ? "" : String(birthYear);
  const [draft, setDraft] = useState(saved);
  const [focused, setFocused] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!focused) setDraft(saved);
  }, [saved, focused]);

  return (
    <input
      className="birth-year-input"
      type="text"
      inputMode="numeric"
      autoComplete="bday-year"
      maxLength={4}
      placeholder={placeholder}
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const next = nextBirthYearDraft(event.target.value);
        draftRef.current = next.draft;
        setDraft(next.draft);
        if ("year" in next) setBirthYear(next.year ?? null);
      }}
      onBlur={() => {
        setFocused(false);
        const next = nextBirthYearDraft(draftRef.current);
        if (next.draft === "" || typeof next.year === "number") {
          setDraft(next.draft);
          return;
        }
        setDraft(saved);
      }}
    />
  );
}

export function BirthYearField() {
  const { t, birthYear, setBirthYear } = useApp();
  return (
    <div className="birth-year">
      <label className="field">
        <span>{t("birthYearOptional")}</span>
        <BirthYearInput />
      </label>
      <p className="hint">{t("birthYearWhere")}</p>
      <p className="hint">{t("birthYearExact")}</p>
      {birthYear != null ? (
        <button type="button" className="ghost" onClick={() => setBirthYear(null)}>
          {t("clearBirthYear")}
        </button>
      ) : null}
    </div>
  );
}
