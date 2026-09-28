"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { passes, resorts } from "@/lib/data";
import { daysUntil, formatDate, formatEur } from "@/lib/format";
import { priceReasonText, regionLabel, type MessageKey } from "@/lib/i18n";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { averageDayTicket, breakEvenDays, passSavings, sortPasses, type PassSort } from "@/lib/pass-economics";
import { adultBracket, deadlinesFor, nextPriceChange, pricesOnDate, resolveForViewer, type Deadline, type ResolvedPrice } from "@/lib/pricing";
import type { Pass } from "@/lib/schema";
import { SourceLine } from "./SourceLine";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { countdownText } from "./countdown";

/**
 * The Passes tab: one card per season pass. Big short name, the official name under it, your price
 * (adult until a birth year is set) with its pre-sale window, and a days slider that compares the
 * pass with buying day tickets.
 */
export function PassesView() {
  const { t, lang, birthYear, setBirthYear, effectiveDate, setPurchaseDate, today } = useApp();
  const [sort, setSort] = useState<PassSort>("price");

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
          <input
            type="number"
            inputMode="numeric"
            min={1920}
            max={2026}
            value={birthYear ?? ""}
            onChange={(event) => setBirthYear(event.target.value === "" ? null : Number(event.target.value))}
          />
        </label>
        <label className="field compact-field">
          <span>{t("purchaseDate")}</span>
          <input type="date" value={effectiveDate ?? ""} onChange={(event) => setPurchaseDate(event.target.value || null)} />
        </label>
        <div className="field compact-field">
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

      <ul className="pass-cards">
        {sorted.map((card) => (
          <PassCard key={card.pass.id} pass={card.pass} price={card.price} covered={card.covered} regions={card.regions} day={card.day} />
        ))}
      </ul>

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
  pass,
  price,
  covered,
  regions,
  day,
}: {
  pass: Pass;
  price: ResolvedPrice;
  covered: number;
  regions: string[];
  day: { eur: number; resorts: number } | null;
}) {
  const { t, lang, birthYear, effectiveDate, messages } = useApp();
  const href = useLocalizedPath();
  if (!effectiveDate) return null;
  const change = nextPriceChange(pass, birthYear, effectiveDate);
  const tariffs = pricesOnDate(pass, effectiveDate);
  const adult = adultBracket(pass);
  const matched = birthYear != null && price.reason === "ok" ? price.bracketId : null;
  const listed = birthYear == null ? tariffs.filter((row) => row.bracketId !== adult?.label) : tariffs;
  const regionNames = regions.map((region) => regionLabel(messages, region)).join(", ");
  return (
    <li className="pass-card" style={{ "--pass": pass.color } as CSSProperties}>
      <div className="pass-row-top">
        <span className="pass-mark" aria-hidden="true" />
        <div className="pass-row-names">
          <h2 className="pass-short">
            {passShortName(pass)}
            {pass.provisional ? <span className="badge">{t("provisional")}</span> : null}
          </h2>
          {passHasShortName(pass) ? <span className="pass-official">{pass.name}</span> : null}
          <span className="pass-meta">
            {t("resortsCovered", { n: covered })}
            {regionNames ? ` · ${regionNames}` : ""}
          </span>
        </div>
        <div className="pass-row-price">
          {price.amountEur != null ? (
            <span className="price-lg num">{formatEur(lang, price.amountEur)}</span>
          ) : price.reason === "age-not-birth-year" ? null : (
            <span className="price-lg">{priceReasonText(messages, lang, price.reason, price.bracketId, price.nextPeriodStart)}</span>
          )}
          {price.ageAtPurchase && price.bracketLabel ? <span className="pass-meta">{price.bracketLabel}</span> : null}
          {price.amountEur != null && price.periodEnd ? <span className="until-chip">{t("periodUntil", { date: formatDate(lang, price.periodEnd) })}</span> : null}
        </div>
      </div>
      {price.ageAtPurchase || price.reason === "age-not-birth-year" ? <p className="hint pass-note">{t("ageNotBirthYear")}</p> : null}
      {change ? <p className="hint warn pass-note">{t("priceAfter", { price: formatEur(lang, change.toEur), date: formatDate(lang, change.date) })}</p> : null}
      {price.amountEur != null ? <DaysCalculator passEur={price.amountEur} day={day} /> : null}
      {listed.length > 0 ? (
        <details className="tariffs" open={birthYear != null}>
          <summary>{birthYear == null ? t("otherTariffs") : t("yourBracket")}</summary>
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
        <a className="ghost" href={pass.url} target="_blank" rel="noopener noreferrer">
          {t("officialSite")} ↗
        </a>
      </div>
      <SourceLine source={pass.source} t={t} lang={lang} />
    </li>
  );
}

/** Pass price against N days of (adult) day tickets at the resorts the pass covers. */
function DaysCalculator({ passEur, day }: { passEur: number; day: { eur: number; resorts: number } | null }) {
  const { t, lang } = useApp();
  const even = breakEvenDays(passEur, day?.eur ?? null);
  const [days, setDays] = useState(() => Math.min(40, Math.max(3, Math.ceil(even ?? 10))));
  if (!day || even == null) return <p className="hint pass-note">{t("breakEvenUnknown")}</p>;
  const dayTotal = Math.round(day.eur * days);
  const savings = passSavings(passEur, day.eur, days);
  const scale = Math.max(passEur, dayTotal, 1);
  return (
    <div className="days-calc">
      <p className="days-calc-head">
        <strong>{t("paysOffAvg", { n: Math.ceil(even) })}</strong>
        <span className="hint">{t("avgDayTicket", { price: formatEur(lang, Math.round(day.eur)), n: day.resorts })}</span>
      </p>
      <label className="days-slider">
        <span className="num">{t("skiDaysValue", { n: days })}</span>
        <input type="range" min={1} max={40} step={1} value={days} onChange={(event) => setDays(Number(event.target.value))} />
      </label>
      <div className="compare-bars" aria-live="polite">
        <div className="compare-bar">
          <span>{t("passPrice")}</span>
          <span className="meter">
            <span style={{ width: `${(passEur / scale) * 100}%`, background: "var(--pass)" }} />
          </span>
          <span className="num">{formatEur(lang, passEur)}</span>
        </div>
        <div className="compare-bar">
          <span>{t("dayTicketsOnly")}</span>
          <span className="meter">
            <span style={{ width: `${(dayTotal / scale) * 100}%` }} />
          </span>
          <span className="num">{formatEur(lang, dayTotal)}</span>
        </div>
      </div>
      <p className={savings >= 0 ? "save" : "hint"}>
        {savings >= 0 ? t("youSave", { amount: formatEur(lang, savings) }) : t("dayTicketsCheaper", { amount: formatEur(lang, -savings) })}
      </p>
      <p className="fact-source">{t("dayTicketAdultNote")}</p>
    </div>
  );
}
