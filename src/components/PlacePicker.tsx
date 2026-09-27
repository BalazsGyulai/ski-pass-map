"use client";

import { useState } from "react";
import { matchReferenceCities } from "@/lib/places";
import { useApp } from "./AppState";

export function PlacePicker() {
  const { t, places, activePlaceId, saveCity, activatePlace, removePlace, locate, locating, geoError } = useApp();
  const [query, setQuery] = useState("");
  const matches = matchReferenceCities(query);

  return (
    <fieldset className="place-picker">
      <legend>{t("referencePlace")}</legend>
      <p className="hint">{t("referencePlaceHint")}</p>
      {places.length === 0 ? <p className="hint">{t("noSavedPlace")}</p> : null}
      {places.length > 0 ? (
        <ul className="place-list">
          {places.map((place) => {
            const active = place.id === activePlaceId;
            return (
              <li key={place.id} className="place-row">
                <button
                  type="button"
                  className={active ? "primary" : "ghost"}
                  aria-pressed={active}
                  onClick={() => activatePlace(place.id)}
                >
                  {t("usePlace", { name: place.label })}
                </button>
                <button type="button" className="icon-btn" aria-label={t("deletePlace", { name: place.label })} onClick={() => removePlace(place.id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <label className="field">
        <span className="sr-only">{t("referencePlace")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("referencePlace")}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {query.trim().length >= 2 && matches.length === 0 ? <p className="hint">{t("noPlaceMatch")}</p> : null}
      {matches.length > 0 ? (
        <ul className="type-list">
          {matches.map((city) => (
            <li key={city.id}>
              <button
                type="button"
                onClick={() => {
                  saveCity(city);
                  setQuery("");
                }}
              >
                {t("savePlace", { name: city.name })}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="ghost wide" onClick={locate} disabled={locating}>
        {locating ? t("locating") : t("useMyLocation")}
      </button>
      {geoError === "denied" ? <p className="hint warn">{t("geoDenied")}</p> : null}
      {geoError === "unsupported" ? <p className="hint warn">{t("geoUnsupported")}</p> : null}
    </fieldset>
  );
}
