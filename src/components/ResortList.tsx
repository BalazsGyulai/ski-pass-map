"use client";

import { passById } from "@/lib/data";
import { passShortName } from "@/lib/pass-label";
import { distanceKm } from "@/lib/distance";
import { finiteOrBlank, formatEur, formatKm } from "@/lib/format";
import { regionLabel } from "@/lib/i18n";
import { dayTicketIsEstimate } from "@/lib/pricing";
import type { Resort } from "@/lib/schema";
import { useApp } from "./AppState";

export function ResortList({ items }: { items: Resort[] }) {
  const { share, favourites, toggleFavourite, selectResort, setHighlightId, home, t, lang, resortDays } = useApp();

  return (
    <ul className="resort-list">
      {items.map((resort) => {
        const distance = home ? distanceKm(home, resort) : null;
        const fav = favourites.includes(resort.id);
        const days = resortDays[resort.id] ?? 0;
        const stats = statLine(resort, t);
        const day = finiteOrBlank(resort.day_ticket_eur);
        return (
          <li
            key={resort.id}
            id={`resort-${resort.id}`}
            className={`resort-row${share.resort === resort.id ? " is-selected" : ""}${resort.abandoned ? " is-closed" : ""}`}
          >
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
                {resort.abandoned ? <span className="badge warn">{t("statusClosed")}</span> : null}
                {resort.needs_recheck ? <span className="badge warn">{t("needsRecheck")}</span> : null}
              </span>
              <span className="meta">
                {regionLabel(lang, resort.region)}
                {distance != null && formatKm(distance) ? ` · ${formatKm(distance)} ${t("km")}` : ""}
              </span>
              {stats ? <span className="card-stats">{stats}</span> : null}
              <span className="card-foot">
                <PassDots ids={resort.passes} />
                {day != null ? (
                  <span className="num">
                    {formatEur(lang, day)}
                    {dayTicketIsEstimate(resort.day_ticket_season, day) ? ` · ${t("estimate")}` : ""}
                    {resort.day_ticket_dynamic ? ` · ${t("dynamicPricing")}` : ""}
                    {resort.day_ticket_network_note ? ` · ${t("networkPrice")}` : ""}
                  </span>
                ) : resort.day_ticket_dynamic ? (
                  <span>{t("dynamicPricing")}</span>
                ) : null}
                {days > 0 ? <span className="amenity">{t("plannedBadge", { n: days })}</span> : null}
              </span>
            </button>
            <button
              type="button"
              className={fav ? "star is-on" : "star"}
              aria-pressed={fav}
              aria-label={fav ? t("favouriteRemove") : t("favouriteAdd")}
              onClick={() => toggleFavourite(resort.id)}
            >
              ★
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function statLine(
  resort: Resort,
  t: (key: "keyStatElev" | "keyStatKm" | "keyStatLifts", vars?: Record<string, string | number>) => string,
): string {
  const parts: string[] = [];
  if (finiteOrBlank(resort.top_elevation_m) != null) parts.push(t("keyStatElev", { n: resort.top_elevation_m ?? 0 }));
  if (finiteOrBlank(resort.slope_km) != null) parts.push(t("keyStatKm", { n: resort.slope_km ?? 0 }));
  if (finiteOrBlank(resort.lifts) != null) parts.push(t("keyStatLifts", { n: resort.lifts ?? 0 }));
  return parts.join(" · ");
}

function PassDots({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  const shown = ids.slice(0, 3);
  return (
    <span className="pass-dots">
      {shown.map((id) => {
        const pass = passById.get(id);
        const title = pass ? (passShortName(pass) === pass.name ? pass.name : `${passShortName(pass)}, ${pass.name}`) : id;
        return <span key={id} className="pass-dot" style={{ background: pass?.color ?? "#94A3B8" }} title={title} />;
      })}
      {ids.length > 3 ? <span className="pill-more">+{ids.length - 3}</span> : null}
    </span>
  );
}
