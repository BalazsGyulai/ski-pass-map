"use client";

import { useEffect, useRef, useState } from "react";
import { nextSheetSnap, snapFromKey, type SheetSnap } from "@/lib/sheet";
import Link from "next/link";
import { passById, resortById } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { filterResorts } from "@/lib/filter";
import { finiteOrBlank, formatBreakEven, formatDate, formatEur, formatKm } from "@/lib/format";
import { bracketLabel, priceReasonText, regionLabel } from "@/lib/i18n";
import { passes, resorts } from "@/lib/data";
import type { Resort } from "@/lib/schema";
import type { MessageKey } from "@/lib/i18n";
import type { Lang } from "@/lib/url-state";
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
        onKeyDown={(event) => {
          if (!window.matchMedia("(max-width: 899px)").matches) return;
          const next = snapFromKey(snap, event.key);
          if (next == null || next === snap) return;
          event.preventDefault();
          if (next === "close") selectResort(null);
          else setSnap(next);
        }}
        tabIndex={0}
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
          {resort.abandoned ? <span className="badge warn">{t("statusClosed")}</span> : null}
          {resort.abandoned ? <span className="hint warn">{t("closedWarning")}</span> : null}
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
            const dayTicket = finiteOrBlank(resort.day_ticket_eur);
            const breakEven = amount != null && dayTicket != null && dayTicket > 0 ? amount / dayTicket : null;
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
                    {t("breakEvenHere")}:{" "}
                    {breakEven != null
                      ? t("breakEvenDays", { n: formatBreakEven(breakEven) })
                      : dayTicket == null
                        ? t("breakEvenUnknown")
                        : t("unknown")}
                  </p>
                  <a href={pass.url} target="_blank" rel="noopener noreferrer">
                    {t("officialSite")}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
        {!birthYear ? <p className="hint">{t("setBirthYearHint")}</p> : null}

        <ResortFacts resort={resort} t={t} lang={lang} />
        {resort.season_dates ? (
          <p>
            <strong>{t("seasonDates")}: </strong>
            {resort.season_dates}
          </p>
        ) : null}
        {resort.notes ? (
          <p>
            <strong>{t("notes")}: </strong>
            {resort.notes}
          </p>
        ) : null}

        {resort.public_transport ? (
          <>
            <h3>{t("klima")}</h3>
            <p>{resort.public_transport}</p>
          </>
        ) : null}

        <div className="link-buttons">
          <LinkButton href={resort.website} label={t("openWebsite")} />
        </div>
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

function ResortFacts({
  resort,
  t,
  lang,
}: {
  resort: Resort;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  lang: Lang;
}) {
  const rows: { label: string; value: string }[] = [];
  const day = finiteOrBlank(resort.day_ticket_eur);
  if (day != null) {
    const season = resort.day_ticket_season ?? "";
    const estimate = season && season !== "2025/26" ? ` · ${t("estimate")}` : "";
    rows.push({ label: t("dayTicket"), value: `${formatEur(lang, day)}${season ? ` ${season}` : ""}${estimate}` });
  }
  const top = finiteOrBlank(resort.top_elevation_m);
  if (top != null) rows.push({ label: t("elevation"), value: `${top} m` });
  const base = finiteOrBlank(resort.base_elevation_m);
  if (base != null) rows.push({ label: t("baseElevation"), value: `${base} m` });
  const slope = finiteOrBlank(resort.slope_km);
  if (slope != null) rows.push({ label: t("slopeKm"), value: `${slope} km` });
  const lifts = finiteOrBlank(resort.lifts);
  if (lifts != null) rows.push({ label: t("lifts"), value: String(lifts) });
  if (resort.snowpark === true) rows.push({ label: t("snowpark"), value: t("yes") });
  if (resort.night_skiing === true) rows.push({ label: t("nightSkiing"), value: t("yes") });
  if (rows.length === 0) return null;
  return (
    <>
      <h3>{t("stats")}</h3>
      <dl className="stat-grid">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </>
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
