"use client";

import { useEffect } from "react";
import { passById, passes, resorts } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { filterResorts, sortResorts } from "@/lib/filter";
import { formatEur, formatKm } from "@/lib/format";
import { resolvePrice } from "@/lib/pricing";
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
    birthYear,
    effectiveDate,
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
                  <span className="resort-name">{resort.name}</span>
                  {resort.status === "closed?" ? <span className="badge warn">{t("statusClosed")}</span> : null}
                </span>
                <span className="card-stats">
                  <span>{distance != null ? `${formatKm(distance)} ${t("km")}` : t("unknown")}</span>
                  <span>{resort.top_elevation_m == null ? t("unknown") : `${resort.top_elevation_m} m`}</span>
                  <span>{resort.slope_km == null ? t("unknown") : `${resort.slope_km} ${t("km")}`}</span>
                  <span>{cardPrice(resort, birthYear, effectiveDate, lang, t)}</span>
                </span>
                <span className="card-foot">
                  <PassBadges ids={resort.passes} emptyLabel={t("noPass")} />
                  <span className="amenity-row">
                    {resort.snowpark ? <span className="amenity" title={t("snowpark")}>{t("snowpark")}</span> : null}
                    {resort.night_skiing ? <span className="amenity" title={t("nightSkiing")}>{t("nightSkiing")}</span> : null}
                    {days > 0 ? <span className="amenity">{t("plannedBadge", { n: days })}</span> : null}
                  </span>
                </span>
                <span className="sr-only">{regionLabel(lang, resort.region)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PassBadges({ ids, emptyLabel }: { ids: string[]; emptyLabel: string }) {
  if (ids.length === 0) return <span className="pass-pill is-empty">{emptyLabel}</span>;
  return (
    <span className="pass-pills">
      {ids.map((id) => {
        const pass = passById.get(id);
        return (
          <span key={id} className="pass-pill" style={{ background: pass?.color ?? "#8b938e" }}>
            {pass?.name ?? id}
          </span>
        );
      })}
    </span>
  );
}

function cardPrice(
  resort: { passes: string[]; day_ticket_eur: number | null; day_ticket_season: string | null },
  birthYear: number | null,
  effectiveDate: string | null,
  lang: "en" | "hu",
  t: (key: "dayTicket" | "unknown" | "estimate", vars?: Record<string, string | number>) => string,
): string {
  if (effectiveDate) {
    let best: number | null = null;
    for (const id of resort.passes) {
      const pass = passById.get(id);
      if (!pass) continue;
      const price = resolvePrice(pass, birthYear, effectiveDate);
      if (price.amountEur != null && (best == null || price.amountEur < best)) best = price.amountEur;
    }
    if (best != null) return formatEur(lang, best);
  }
  if (resort.day_ticket_eur == null) return t("unknown");
  const estimate = resort.day_ticket_season !== "2025/26" ? ` (${t("estimate")})` : "";
  return `${t("dayTicket")} ${formatEur(lang, resort.day_ticket_eur)}${estimate}`;
}
