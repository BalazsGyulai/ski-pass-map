"use client";

import { useEffect } from "react";
import { passById, passes, resorts } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { filterResorts, sortResorts } from "@/lib/filter";
import { formatKm } from "@/lib/format";
import { regionLabel } from "@/lib/i18n";
import { useApp } from "./AppState";

export function ResortList() {
  const {
    share,
    favourites,
    toggleFavourite,
    selectResort,
    setHighlightId,
    home,
    t,
    lang,
    resortDays,
  } = useApp();
  const passNames = new Map(passes.map((pass) => [pass.id, pass.name]));
  const filtered = filterResorts(resorts, share, {
    home,
    favourites: new Set(favourites),
    passNames,
  });
  const sorted = sortResorts(filtered, share.sort, share.dir, (resort) => (home ? distanceKm(home, resort) : null));

  useEffect(() => {
    if (!share.resort) return;
    document.getElementById(`resort-${share.resort}`)?.scrollIntoView({ block: "nearest" });
  }, [share.resort]);

  return (
    <section className="list-col" aria-label={t("resorts")}>
      <p className="result-count" aria-live="polite">
        {t("resultCount", { n: sorted.length, total: resorts.length })}
      </p>
      {share.favouritesOnly && favourites.length === 0 ? <p className="hint">{t("noFavourites")}</p> : null}
      {sorted.length === 0 ? <p className="empty">{t("noResults")}</p> : null}
      <ul className="resort-list">
        {sorted.map((resort) => {
          const distance = home ? distanceKm(home, resort) : null;
          const fav = favourites.includes(resort.id);
          const days = resortDays[resort.id] ?? 0;
          return (
            <li
              key={resort.id}
              id={`resort-${resort.id}`}
              className={
                share.resort === resort.id
                  ? `resort-row is-selected${resort.status === "closed?" ? " is-closed" : ""}`
                  : `resort-row${resort.status === "closed?" ? " is-closed" : ""}`
              }
            >
              <button
                type="button"
                className={fav ? "star is-on" : "star"}
                aria-pressed={fav}
                aria-label={fav ? t("favouriteRemove") : t("favouriteAdd")}
                onClick={() => toggleFavourite(resort.id)}
              >
                ★
              </button>
              <button
                type="button"
                className="resort-open"
                aria-pressed={share.resort === resort.id}
                onClick={() => selectResort(resort.id)}
                onMouseEnter={() => setHighlightId(resort.id)}
                onMouseLeave={() => setHighlightId(null)}
                onFocus={() => setHighlightId(resort.id)}
                onBlur={() => setHighlightId(null)}
              >
                <span className="name-line">
                  <PassDots ids={resort.passes} />
                  <span>{resort.name}</span>
                </span>
                <span className="meta">
                  {regionLabel(lang, resort.region)}
                  {distance != null ? ` · ${formatKm(distance)} ${t("km")} ${t("straightLineShort")}` : ""}
                  {` · ${t("dayTicket")}: ${
                    resort.day_ticket_eur == null
                      ? t("unknown")
                      : `€${resort.day_ticket_eur}${resort.day_ticket_season === "2025/26" ? "" : ` (${t("estimate")})`}`
                  }`}
                  {resort.status === "closed?" ? ` · ${t("statusClosed")}` : ""}
                  {` · ${t("elevation")}: ${resort.top_elevation_m == null ? t("unknown") : `${resort.top_elevation_m} m`}`}
                  {days > 0 ? ` · ${t("plannedBadge", { n: days })}` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PassDots({ ids }: { ids: string[] }) {
  if (ids.length === 0) return <span className="dot dot-grey" aria-hidden="true" />;
  return (
    <span className="dots" aria-hidden="true">
      {ids.map((id) => (
        <span key={id} className="dot" style={{ background: passById.get(id)?.color ?? "#8b938e" }} />
      ))}
    </span>
  );
}
