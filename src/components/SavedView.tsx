"use client";

import Link from "next/link";
import { resortById } from "@/lib/data";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

/** Favourite resorts. Shown inside My plan; /saved redirects there. */
export function SavedView() {
  const { favourites, t, toggleFavourite } = useApp();
  const href = useLocalizedPath();
  const resorts = favourites.map((id) => resortById.get(id)).filter((resort) => resort != null);

  return (
    <section id="saved" className="card-block saved-block" aria-labelledby="saved-title">
      <h2 id="saved-title">{t("savedPageTitle")}</h2>
      {resorts.length === 0 ? (
        <p className="hint">{t("savedEmpty")}</p>
      ) : (
        <ul className="saved-list">
          {resorts.map((resort) => (
            <li key={resort.id} className="saved-row">
              <Link href={`${href("/")}?resort=${resort.id}`} className="saved-link">
                <strong>{resort.name}</strong>
                <span className="hint">{t("savedOpenOnMap")}</span>
              </Link>
              <button type="button" className="icon-btn" aria-pressed="true" aria-label={t("favouriteRemove")} onClick={() => toggleFavourite(resort.id)}>
                ♥
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
