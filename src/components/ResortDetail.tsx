"use client";

import { useEffect, useRef, useState } from "react";
import { nextSheetSnap, type SheetSnap } from "@/lib/sheet";
import Link from "next/link";
import { passById, resortById } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { filterResorts } from "@/lib/filter";
import { formatBreakEven, formatDate, formatEur, formatKm } from "@/lib/format";
import { bracketLabel, priceReasonText, regionLabel } from "@/lib/i18n";
import { passes, resorts } from "@/lib/data";
import { resolvePrice } from "@/lib/pricing";
import { useApp } from "./AppState";

export function ResortDetail() {
  const {
    share,
    selectResort,
    favourites,
    toggleFavourite,
    resortDays,
    setResortDaysCount,
    birthYear,
    effectiveDate,
    home,
    t,
    lang,
  } = useApp();
  const resort = share.resort ? resortById.get(share.resort) : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const [snap, setSnap] = useState<SheetSnap>("half");

  useEffect(() => {
    closeRef.current?.focus();
    setSnap("half");
  }, [resort?.id]);

  useEffect(() => {
    if (!resort) return;
    document.documentElement.dataset.sheet = snap;
    return () => {
      delete document.documentElement.dataset.sheet;
    };
  }, [resort, snap]);

  function onGrabPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    if ((event.target as HTMLElement).closest("button, a, input")) return;
    const origin = snap;
    const startY = event.clientY;
    let lastY = startY;
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = (ev: PointerEvent) => {
      lastY = ev.clientY;
      const dy = Math.max(-80, lastY - startY);
      sheetRef.current?.style.setProperty("transform", `translateY(${dy}px)`);
      sheetRef.current?.style.setProperty("transition", "none");
    };
    const end = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      sheetRef.current?.style.removeProperty("transform");
      sheetRef.current?.style.removeProperty("transition");
      const dy = lastY - startY;
      if (dy > 56) {
        const next = nextSheetSnap(origin, "down");
        if (next === "close") selectResort(null);
        else setSnap(next);
      } else if (dy < -56) {
        const next = nextSheetSnap(origin, "up");
        if (next !== "close") setSnap(next);
      }
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  if (!resort) return null;

  const visible = filterResorts(resorts, share, {
    home,
    favourites: new Set(favourites),
    passNames: new Map(passes.map((pass) => [pass.id, pass.name])),
  }).some((item) => item.id === resort.id);
  const distance = home ? distanceKm(home, resort) : null;
  const fav = favourites.includes(resort.id);
  const days = resortDays[resort.id] ?? 0;

  return (
    <article ref={sheetRef} className={`detail-sheet snap-${snap}`} aria-labelledby="resort-title">
      <div
        className="sheet-grab"
        onPointerDown={onGrabPointerDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label={t("sheetHandle")}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={snap === "peek" ? 0 : snap === "half" ? 1 : 2}
        aria-valuetext={snap}
      >
        <span className="grab-bar" />
      </div>
      <header className="detail-head" onPointerDown={onGrabPointerDown}>
        <p className="eyebrow">{regionLabel(lang, resort.region)}</p>
        <h2 id="resort-title">{resort.name}</h2>
        <p className="meta">
          <span className={resort.status === "open" ? "badge" : "badge warn"}>{resort.status === "open" ? t("statusOpen") : t("statusClosed")}</span>
          {resort.status === "closed?" ? <span className="hint warn">{t("closedWarning")}</span> : null}
          {distance != null ? <span>{t("distanceValue", { n: formatKm(distance) })}</span> : null}
        </p>
        <button ref={closeRef} type="button" className="icon-btn" onClick={() => selectResort(null)}>
          {t("close")}
        </button>
      </header>
      <div className="detail-body">
        {!visible ? <p className="hint warn">{t("hiddenByFilters")}</p> : null}
        <h3>{t("passes")}</h3>
        {resort.passes.length === 0 ? <p>{t("noPasses")}</p> : null}
        <ul className="pass-lines">
          {resort.passes.map((id) => {
            const pass = passById.get(id);
            if (!pass) return null;
            const price = effectiveDate ? resolvePrice(pass, birthYear, effectiveDate) : null;
            const amount = price?.amountEur ?? null;
            const breakEven =
              amount != null && resort.day_ticket_eur != null && resort.day_ticket_eur > 0
                ? amount / resort.day_ticket_eur
                : null;
            return (
              <li key={id}>
                <span className="swatch" style={{ background: pass.color }} />
                <div>
                  <strong>{pass.name}</strong>
                  <p>
                    {price?.bracketId ? `${bracketLabel(lang, price.bracketId, price.bracketLabel ?? "")}: ` : `${t("priceForYou")}: `}
                    {amount != null ? formatEur(lang, amount) : price ? priceReasonText(lang, price.reason, price.bracketId, price.nextPeriodStart) : t("unknown")}
                    {price?.periodEnd ? ` · ${t("periodUntil", { date: formatDate(lang, price.periodEnd) })}` : ""}
                  </p>
                  <p className="hint">
                    {t("breakEvenHere")}: {breakEven != null ? t("breakEvenDays", { n: formatBreakEven(breakEven) }) : t("breakEvenUnknown")}
                  </p>
                  <a href={pass.url} target="_blank" rel="noreferrer">
                    {t("officialSite")}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        {!birthYear ? <p className="hint">{t("setBirthYearHint")}</p> : null}

        <h3>{t("stats")}</h3>
        <dl className="stat-grid">
          <div>
            <dt>{t("dayTicket")}</dt>
            <dd>
              {resort.day_ticket_eur == null ? (
                t("unknown")
              ) : (
                <>
                  {formatEur(lang, resort.day_ticket_eur)}
                  <span className="hint">
                    {" "}
                    {resort.day_ticket_season ?? t("seasonUnknown")}
                    {resort.day_ticket_season !== "2025/26" ? ` · ${t("estimate")}` : ""}
                  </span>
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>{t("elevation")}</dt>
            <dd>{resort.top_elevation_m == null ? t("unknown") : `${resort.top_elevation_m} m`}</dd>
          </div>
          <div>
            <dt>{t("baseElevation")}</dt>
            <dd>{resort.base_elevation_m == null ? t("unknown") : `${resort.base_elevation_m} m`}</dd>
          </div>
          <div>
            <dt>{t("slopeKm")}</dt>
            <dd>{resort.slope_km == null ? t("unknown") : `${resort.slope_km} km`}</dd>
          </div>
          <div>
            <dt>{t("lifts")}</dt>
            <dd>{resort.lifts == null ? t("unknown") : resort.lifts}</dd>
          </div>
          <div>
            <dt>{t("snowpark")}</dt>
            <dd>{resort.snowpark === true ? t("yes") : t("unknown")}</dd>
          </div>
          <div>
            <dt>{t("nightSkiing")}</dt>
            <dd>{resort.night_skiing === true ? t("yes") : t("unknown")}</dd>
          </div>
        </dl>
        {resort.stats_source ? (
          <p className="hint">
            <strong>{t("statsSource")}: </strong>
            {resort.stats_source}
          </p>
        ) : null}
        {resort.season_dates_2026_27 ? (
          <p>
            <strong>{t("seasonDates")}: </strong>
            {resort.season_dates_2026_27}
          </p>
        ) : null}
        {resort.feature_evidence ? (
          <p>
            <strong>{t("featureEvidence")}: </strong>
            {resort.feature_evidence}
          </p>
        ) : null}
        {resort.notes ? (
          <p>
            <strong>{t("notes")}: </strong>
            {resort.notes}
          </p>
        ) : null}

        <h3>{t("klima")}</h3>
        <p>{resort.klimaticket ? t("klimaYes") : t("klimaNo")}</p>
        {resort.public_transport_note ? (
          <p>
            <strong>{t("transportNote")}: </strong>
            {resort.public_transport_note}
          </p>
        ) : null}

        <div className="link-buttons">
          <LinkButton href={resort.website} label={t("openWebsite")} />
          <LinkButton href={resort.snow_report_url} label={t("snowReport")} />
          <LinkButton href={resort.webcam_url} label={t("webcams")} />
          <LinkButton href={resort.piste_map_url ?? null} label={t("pisteMapOfficial")} />
        </div>
        <ul className="link-list">
          <External href={resort.skiresort_url} label={t("skiresort")} unknown={t("unknown")} optional />
          <External href={resort.bergfex_url} label={t("bergfex")} unknown={t("unknown")} optional />
        </ul>
      </div>
      <footer className="sheet-actions">
        <button type="button" className={fav ? "primary" : "ghost"} aria-pressed={fav} onClick={() => toggleFavourite(resort.id)}>
          {fav ? t("favouriteRemove") : t("favouriteAdd")}
        </button>
        <div className="stepper">
          <button type="button" aria-label={t("decreaseDays")} onClick={() => setResortDaysCount(resort.id, days - 1)}>
            −
          </button>
          <span className="num">{t("plannedBadge", { n: days })}</span>
          <button type="button" aria-label={t("increaseDays")} onClick={() => setResortDaysCount(resort.id, days + 1)}>
            +
          </button>
        </div>
        <Link className="ghost linkish" href="/plan">
          {t("navPlan")}
        </Link>
      </footer>
    </article>
  );
}

function LinkButton({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function External({ href, label, unknown, optional }: { href: string | null; label: string; unknown: string; optional?: boolean }) {
  if (!href && optional) return null;
  return (
    <li>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        <span>
          {label}: {unknown}
        </span>
      )}
    </li>
  );
}
