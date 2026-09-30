"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { passes, resorts } from "@/lib/data";
import { daysUntil, formatDate, formatEur } from "@/lib/format";
import { priceReasonText, regionLabel, type MessageKey } from "@/lib/i18n";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { averageDayTicket, passSavings, sortPasses, type PassSort } from "@/lib/pass-economics";
import { adultBracket, deadlinesFor, nextPriceChange, pricesOnDate, resolveForViewer, type Deadline, type ResolvedPrice } from "@/lib/pricing";
import type { Pass } from "@/lib/schema";
import { BirthYearInput } from "./BirthYearField";
import { SourceLine } from "./SourceLine";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { ExternalSiteLink } from "./ExternalSiteLink";
import { countdownText } from "./countdown";

/**
 * The Passes tab: one row per season pass. The short name, official name, resort count, and price
 * line up so the list can be compared at a glance. Day tickets and the other tariffs stay closed
 * until they are opened.
 */
export function PassesView() {
  const { t, lang, birthYear, effectiveDate, setPurchaseDate, today } = useApp();
  const [sort, setSort] = useState<PassSort>("price");
  const [skiDays, setSkiDays] = useState(6);

  const cards = useMemo(() => {
    if (!effectiveDate) return [];
    return passes.map((pass) => {
      const covered = resorts.filter((resort) => resort.passes.includes(pass.id) && !resort.abandoned);
      return {
        pass,
        price: resolveForViewer(pass, birthYear, effectiveDate),
        covered: covered.length,
        // "Lower Austria / Styria" style regions count for both parts.
        regions: [...new Set(covered.flatMap((resort) => resort.region.split("/").map((part) => part.trim())).filter(Boolean))],
        day: averageDayTicket(pass, resorts),
      };
    });
  }, [birthYear, effectiveDate]);
  const sorted = sortPasses(cards, sort, (card) => ({ price: card.price.amountEur, resorts: card.covered, name: passShortName(card.pass) }));

  const events = passes
    .flatMap((pass) => deadlinesFor(pass).map((deadline) => ({ ...deadline, pass })))
    .filter((event) => !today || daysUntil(today, event.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.pass.name.localeCompare(b.pass.name, "de"));

  return (
    <div className="page page-narrow passes-page">
      <header className="page-head">
        <h1>{t("passes")}</h1>
        <p className="lede">{t("compareIntro")}</p>
      </header>

      <section className="passes-controls" aria-label={t("pricesFor")}>
        <label className="field compact-field">
          <span>{t("birthYearOptional")}</span>
          <BirthYearInput placeholder={t("birthYearPlaceholder")} />
        </label>
        <label className="field compact-field">
          <span>{t("purchaseDate")}</span>
          <input type="date" placeholder={t("purchaseDatePlaceholder")} value={effectiveDate ?? ""} onChange={(event) => setPurchaseDate(event.target.value || null)} />
        </label>
        <label className="field compact-field passes-days">
          <span>{t("skiDays")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            placeholder={t("skiDaysPlaceholder")}
            value={skiDays}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isInteger(value)) return;
              setSkiDays(Math.min(40, Math.max(1, value)));
            }}
          />
        </label>
        <div className="field compact-field passes-sort">
          <span id="pass-sort-label">{t("sort")}</span>
          <div className="seg-control" role="radiogroup" aria-labelledby="pass-sort-label">
            {(
              [
                ["price", t("priceForYou")],
                ["resorts", t("resorts")],
                ["name", t("sortName")],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={sort === value} className={sort === value ? "is-on" : undefined} onClick={() => setSort(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      {birthYear == null ? <p className="hint">{t("birthYearExact")}</p> : null}

      <div className="pass-board">
        {[0, 1].map((column) => (
          <ul key={column} className="pass-col">
            {sorted.flatMap((card, index) =>
              index % 2 === column ? (
                <PassCard key={card.pass.id} order={index} pass={card.pass} price={card.price} covered={card.covered} regions={card.regions} day={card.day} skiDays={skiDays} />
              ) : [],
            )}
          </ul>
        ))}
      </div>

      {events.length > 0 ? (
        <section className="card-block" aria-labelledby="pass-deadlines">
          <h2 id="pass-deadlines">{t("timeline")}</h2>
          <ol className="timeline">
            {events.map((event) => {
              const days = today ? daysUntil(today, event.date) : null;
              return (
                <li key={`${event.pass.id}-${event.id}`} className="timeline-item">
                  <span className="swatch" style={{ background: event.pass.color }} />
                  <div>
                    <strong>{t(DEADLINE_TITLE[event.event])}</strong>
                    <p>
                      {passShortName(event.pass)}
                      {deadlineChange(event, t, lang)}
                    </p>
                    <p className="hint">
                      {formatDate(lang, event.date)}
                      {days != null ? ` · ${countdownText(t, event.kind, days)}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </div>
  );
}

const DEADLINE_TITLE: Record<Deadline["event"], MessageKey> = {
  presale: "timelinePresale",
  ends: "timelinePriceEnds",
  opens: "timelinePriceOpens",
};

/** The adult price change (or the opening tariff) after the pass name; every tariff is on the card. */
function deadlineChange(event: Deadline, t: ReturnType<typeof useApp>["t"], lang: ReturnType<typeof useApp>["lang"]): string {
  if (event.adult) {
    // The price range stays on one line; the break may fall before it.
    const to = event.adult.toEur != null ? `\u00a0→\u00a0${formatEur(lang, event.adult.toEur)}` : "";
    return ` · ${t("bracketAdult")} ${formatEur(lang, event.adult.fromEur)}${to}`;
  }
  if (event.bracket) return ` · ${event.bracket}${event.priceEur != null ? ` ${formatEur(lang, event.priceEur)}` : ""}`;
  return "";
}

function PassCard({
  order,
  pass,
  price,
  covered,
  regions,
  day,
  skiDays,
}: {
  order: number;
  pass: Pass;
  price: ResolvedPrice;
  covered: number;
  regions: string[];
  day: { eur: number; resorts: number } | null;
  skiDays: number;
}) {
  const { t, lang, birthYear, effectiveDate, messages, setResortDaysCount, showToast } = useApp();
  const href = useLocalizedPath();
  if (!effectiveDate) return null;
  const change = nextPriceChange(pass, birthYear, effectiveDate);
  const tariffs = pricesOnDate(pass, effectiveDate);
  const adult = adultBracket(pass);
  const matched = birthYear != null && price.reason === "ok" ? price.bracketId : null;
  const listed = birthYear == null ? tariffs.filter((row) => row.bracketId !== adult?.label) : tariffs;
  const regionNames = regions.map((region) => regionLabel(messages, region)).join(", ");
  const savings = price.amountEur != null && day ? passSavings(price.amountEur, day.eur, skiDays) : null;
  function addToPlan() {
    for (const resort of resorts) {
      if (resort.passes.includes(pass.id) && !resort.abandoned) setResortDaysCount(resort.id, skiDays);
    }
    showToast(t("addedToPlan"));
  }
  return (
    <li className="pass-card" style={{ "--pass": pass.color, "--order": order } as CSSProperties}>
      <div className="pass-card-top">
        <span className="pass-mark" aria-hidden="true" />
        <div className="pass-card-main">
          <h2 className="pass-short">
            {passShortName(pass)}
            {pass.provisional ? <span className="badge">{t("provisional")}</span> : null}
          </h2>
          {passHasShortName(pass) ? <span className="pass-official">{pass.name}</span> : null}
          <span className="pass-meta">{t("resortsCovered", { n: covered })}</span>
        </div>
        <div className="pass-card-price">
          {price.amountEur != null ? (
            <span className="price-lg num">{formatEur(lang, price.amountEur)}</span>
          ) : price.reason === "age-not-birth-year" ? null : (
            <span className="pass-price-note">{priceReasonText(messages, lang, price.reason, price.bracketId, price.nextPeriodStart)}</span>
          )}
          {price.bracketLabel && price.amountEur != null ? <span className="pass-meta">{price.bracketLabel}</span> : null}
          {price.amountEur != null && price.periodEnd ? <span className="until-chip">{t("periodUntil", { date: formatDate(lang, price.periodEnd) })}</span> : null}
        </div>
      </div>
      {regionNames ? <p className="pass-where">{regionNames}</p> : null}
      {price.ageAtPurchase || price.reason === "age-not-birth-year" ? <p className="hint pass-note">{t("ageNotBirthYear")}</p> : null}
      {change ? <p className="hint warn pass-note">{t("priceAfter", { price: formatEur(lang, change.toEur), date: formatDate(lang, change.date) })}</p> : null}
      {savings != null ? (
        <p className={savings >= 0 ? "save pass-save" : "hint pass-save"}>
          {savings >= 0 ? t("youSave", { amount: formatEur(lang, savings) }) : t("dayTicketsCheaper", { amount: formatEur(lang, -savings) })}
        </p>
      ) : price.amountEur != null ? (
        <p className="hint pass-note">{t("breakEvenUnknown")}</p>
      ) : null}
      {listed.length > 0 ? (
        <details className="pass-more tariffs">
          <summary>
            {t("otherTariffs")}
            <svg className="pass-chevron" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <ul className="bracket-list">
            {listed.map((row) => (
              <li key={row.bracketId} className={matched && row.bracketId === matched ? "is-match" : undefined}>
                <span>{row.bracketLabel}</span>
                <span className="num">
                  {row.amountEur != null ? formatEur(lang, row.amountEur) : priceReasonText(messages, lang, row.reason, row.bracketId, row.nextPeriodStart)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="row-actions pass-actions">
        <Link className="ghost" href={`${href("/")}?passes=${encodeURIComponent(pass.id)}`}>
          {t("savedOpenOnMap")}
        </Link>
        <ExternalSiteLink className="ghost" href={pass.url}>
          {t("officialSite")}
        </ExternalSiteLink>
        <button type="button" className="primary" onClick={addToPlan}>
          {t("addToPlan")}
        </button>
      </div>
      <SourceLine source={pass.source} t={t} lang={lang} />
    </li>
  );
}

