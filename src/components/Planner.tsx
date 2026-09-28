"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { passById, resortById, resorts } from "@/lib/data";
import { fold } from "@/lib/filter";
import { finiteOrBlank, formatDate, formatEur } from "@/lib/format";
import { priceReasonText } from "@/lib/i18n";
import { passShortName } from "@/lib/pass-label";
import { cheapestFullCoverage, nextPriceChange, savingsVsDayTickets, type PriceQuote } from "@/lib/pricing";
import { planQuotes, quoteTitle } from "@/lib/plan-quotes";
import type { Lang } from "@/i18n/languages";
import { langPath, pathWithLang } from "@/i18n/routing";
import { serializePlan } from "@/lib/url-state";
import { SavedView } from "./SavedView";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { AffiliateLinksBlock } from "./AffiliateLinks";
import { markFirstVisitDone } from "@/lib/support/storage";

/**
 * My plan: the answer first (which pass is cheapest for the days you plan), then the days per
 * resort that drive it, then the birth year and purchase date the prices depend on.
 */
export function Planner() {
  const app = useApp();
  const { t, lang, birthYear, setBirthYear, setPurchaseDate, effectiveDate, resortDays, setResortDaysCount, clearResortDays, ready, copyMessage, bumpSupportPrompt } = app;
  const href = useLocalizedPath();
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const quotes = useMemo(() => (effectiveDate ? planQuotes(birthYear, effectiveDate, resortDays) : []), [effectiveDate, birthYear, resortDays]);
  const totalPlanned = Object.values(resortDays).reduce((sum, days) => sum + days, 0);
  const priced = quotes.filter((quote) => quote.totalEur != null && totalPlanned > 0).sort((a, b) => (a.totalEur ?? 0) - (b.totalEur ?? 0));
  const best = priced[0] ?? null;
  const dayTickets = quotes.find((quote) => quote.kind === "day-tickets");
  const savings = best && dayTickets ? savingsVsDayTickets(best, dayTickets) : null;
  const others = priced.filter((quote) => quote.id !== best?.id);
  const full = cheapestFullCoverage(quotes);
  const hits = query.trim()
    ? resorts.filter((resort) => fold(resort.name).includes(fold(query.trim())) && !(resortDays[resort.id] > 0)).slice(0, 6)
    : [];

  const alerts = useMemo(() => {
    if (!effectiveDate) return [];
    const used = new Set<string>();
    for (const [id, days] of Object.entries(resortDays)) {
      if (days <= 0) continue;
      for (const passId of resortById.get(id)?.passes ?? []) used.add(passId);
    }
    return [...used]
      .map((id) => {
        const pass = passById.get(id);
        if (!pass) return null;
        const change = nextPriceChange(pass, birthYear, effectiveDate);
        return change ? { ...change, name: passShortName(pass) } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [effectiveDate, resortDays, birthYear]);

  function sharePlan() {
    const params = new URLSearchParams();
    const plan = serializePlan(resortDays);
    if (plan) params.set("plan", plan);
    if (app.purchaseDate) params.set("on", app.purchaseDate);
    const qs = params.toString();
    const url = `${window.location.origin}${pathWithLang(lang, "/plan")}${qs ? `?${qs}` : ""}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        markFirstVisitDone(window.localStorage);
        bumpSupportPrompt();
        window.setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <div className="page page-narrow plan-page">
      <header className="page-head">
        <h1>{t("myPlanLink")}</h1>
        <p className="lede">{t("addDaysPrompt")}</p>
      </header>

      <div className="plan-grid">
        <section className="card-block answer-block" aria-labelledby="plan-answer">
          <h2 id="plan-answer" className="sr-only">
            {t("results")}
          </h2>
          {!ready || !effectiveDate ? <p className="hint">{t("loadingMap")}</p> : null}
          {ready && totalPlanned === 0 ? (
            <div className="plan-empty">
              <p>{t("planEmpty")}</p>
              <Link className="primary" href={href("/")}>
                {t("savedOpenOnMap")}
              </Link>
            </div>
          ) : null}
          {best ? (
            <article className="best-card">
              <p className="best-label">{t("bestValue")}</p>
              <h3>{quoteTitle(best, t)}</h3>
              <p className="price-display num">{best.totalEur != null ? formatEur(lang, best.totalEur) : t("unknownTotal")}</p>
              <p className="best-meta">
                {t("daysCoveredBar", { covered: best.coveredDays, total: totalPlanned })}
                {best.costPerDayEur != null ? ` · ${t("perDay", { amount: formatEur(lang, best.costPerDayEur) })}` : ""}
              </p>
              <div className="coverage" aria-hidden="true">
                <span style={{ width: `${totalPlanned > 0 ? (best.coveredDays / totalPlanned) * 100 : 0}%` }} />
              </div>
              {savings != null && savings > 0 ? <p className="save">{t("youSave", { amount: formatEur(lang, savings) })}</p> : null}
              {best.kind === "day-tickets" ? <p>{t("dayTicketsWin")}</p> : null}
              {best.usesEstimate ? <p className="hint">{t("estimate")}</p> : null}
              {full && full.id !== best.id ? (
                <p className="hint">
                  {t("fullCoverageLabel")}: {quoteTitle(full, t)} · {full.totalEur != null ? formatEur(lang, full.totalEur) : t("unknownTotal")}
                </p>
              ) : null}
            </article>
          ) : null}
          {alerts.map((alert) => (
            <p key={`${alert.name}-${alert.date}`} className="deadline">
              {t("deadlineRises", { name: alert.name, from: formatEur(lang, alert.fromEur), to: formatEur(lang, alert.toEur), date: formatDate(lang, alert.date) })}
            </p>
          ))}
          {others.length > 0 ? (
            <details className="other-options">
              <summary>
                {t("otherOptions")} · {others.length}
              </summary>
              <ul className="option-list">
                {others.map((quote) => (
                  <li key={quote.id}>
                    <details className="option">
                      <summary className="option-row">
                        <span>{quoteTitle(quote, t)}</span>
                        <span className="num">{quote.totalEur != null ? formatEur(lang, quote.totalEur) : t("unknownTotal")}</span>
                      </summary>
                      <Breakdown quote={quote} totalPlanned={totalPlanned} />
                    </details>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="card-block" aria-labelledby="plan-days">
          <h2 id="plan-days">{t("resorts")}</h2>
          <label className="field">
            <span>{t("planSearch")}</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} />
          </label>
          {hits.length > 0 ? (
            <ul className="type-list">
              {hits.map((resort) => (
                <li key={resort.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setResortDaysCount(resort.id, 1);
                      setQuery("");
                    }}
                  >
                    {resort.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="plan-list">
            {Object.entries(resortDays)
              .sort((a, b) => b[1] - a[1])
              .map(([id, days]) => {
                const resort = resortById.get(id);
                if (!resort) return null;
                return (
                  <li key={id}>
                    <div>
                      <Link href={`${langPath(lang, "/")}?resort=${encodeURIComponent(id)}`}>{resort.name}</Link>
                      <span className="pass-dots">
                        {resort.passes.slice(0, 3).map((passId) => (
                          <span key={passId} className="pass-dot" style={{ background: passById.get(passId)?.color ?? "#98a2b3" }} title={passById.get(passId)?.name ?? passId} />
                        ))}
                      </span>
                    </div>
                    <div className="stepper">
                      <button type="button" aria-label={t("decreaseDays")} onClick={() => setResortDaysCount(id, days - 1)}>
                        −
                      </button>
                      <span className="num">{days}</span>
                      <button type="button" aria-label={t("increaseDays")} onClick={() => setResortDaysCount(id, days + 1)}>
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
          {totalPlanned > 0 ? (
            <div className="row-actions">
              <button type="button" className="ghost" onClick={clearResortDays}>
                {t("clearDays")}
              </button>
              <button type="button" className="ghost" onClick={sharePlan}>
                {copied ? t("copied") : copyMessage ?? t("sharePlan")}
              </button>
            </div>
          ) : null}
        </section>

        <section className="card-block" aria-labelledby="plan-prices">
          <h2 id="plan-prices">{t("pricesFor")}</h2>
          <div className="plan-inputs">
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
          </div>
          <p className="hint">{t("purchaseHelp")}</p>
          <p className="hint">{t("savedLocally")}</p>
        </section>
      </div>

      <SavedView />
      <AffiliateLinksBlock />
      <p className="disclaimer">{t("checkOfficial")}</p>
    </div>
  );
}

function Breakdown({ quote, totalPlanned }: { quote: PriceQuote; totalPlanned: number }) {
  const { t, lang, setPurchaseDate, messages } = useApp();
  return (
    <div className="breakdown">
      <p>{t("optionCovers", { covered: quote.coveredDays, total: totalPlanned })}</p>
      <p>
        {t("passPrice")}: {quote.kind === "day-tickets" ? t("dash") : money(lang, quote.passPriceEur, t("unknown"))}
      </p>
      <p>
        {t("uncoveredTicket")}: {quote.uncoveredDays === 0 ? t("dash") : money(lang, quote.uncoveredDayTicketEur, t("unknown"))}
      </p>
      {quote.usesEstimate ? <p className="hint">{t("estimate")}</p> : null}
      {quote.priceReason && quote.passPriceEur == null ? (
        <p className="hint warn">
          {priceReasonText(messages, lang, quote.priceReason, null, quote.nextPeriodStart)}
          {quote.nextPeriodStart ? (
            <button type="button" className="ghost" onClick={() => setPurchaseDate(quote.nextPeriodStart)}>
              {t("useThisDate", { date: formatDate(lang, quote.nextPeriodStart) })}
            </button>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function money(lang: Lang, value: number | null, unknown: string): string {
  const amount = finiteOrBlank(value);
  return amount == null ? unknown : formatEur(lang, amount);
}
