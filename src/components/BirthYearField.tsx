"use client";

import { useApp } from "./AppState";

export function BirthYearField() {
  const { t, birthYear, setBirthYear } = useApp();
  return (
    <div className="birth-year">
      <label className="field">
        <span>{t("birthYearOptional")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={1920}
          max={2026}
          value={birthYear ?? ""}
          onChange={(event) => setBirthYear(event.target.value === "" ? null : Number(event.target.value))}
        />
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
