"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { passById, passes, resortById, resorts } from "@/lib/data";
import { fold } from "@/lib/filter";
import { finiteOrBlank, formatBreakEven, formatDate, formatEur } from "@/lib/format";
import { priceReasonText } from "@/lib/i18n";
import { cheapestFullCoverage, dayTicketIsEstimate, nextPriceChange, quotePlan, savingsVsDayTickets, type PriceQuote } from "@/lib/pricing";
import { BASE_PATH } from "@/lib/site";
import { serializePlan } from "@/lib/url-state";
import { CompareView } from "./CompareView";
import { useApp } from "./AppState";

export function Planner() {
  const app = useApp();
  const { t, lang, birthYear, setBirthYear, setPurchaseDate, effectiveDate, resortDays, setResortDaysCount, clearResortDays, ready, share, updateShare, copyMessage } = app;
  const [tab, setTab] = useState<"plan" | "prices">("plan");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const quotes = useMemo(() => {
    if (!effectiveDate) return [];
    return quotePlan(
      passes,
      resorts.map((resort) => ({
        id: resort.id,
        name: resort.name,
        region: resort.region,
        passes: resort.passes,
        dayTicketEur: resort.day_ticket_eur,
        dayTicketEstimate: dayTicketIsEstimate(resort.day_ticket_season, resort.day_ticket_eur),
      })),
      birthYear,
      effectiveDate,
      Object.entries(resortDays).map(([id, days]) => ({ id, days })),
      share.age,
    );
  }, [effectiveDate, birthYear, resortDays, share.age]);

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
        const change = nextPriceChange(pass, birthYear, effectiveDate, share.age);
        return change ? { ...change, name: pass.name } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item != null)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
  }, [effectiveDate, resortDays, birthYear, share.age]);

  function sharePlan() {
    const params = new URLSearchParams();
    const plan = serializePlan(resortDays);
    if (plan) params.set("plan", plan);
    if (app.purchaseDate) params.set("on", app.purchaseDate);
    if (share.age !== "adult") params.set("age", share.age);
    if (share.lang !== "en") params.set("lang", share.lang);
    const url = `${window.location.origin}${BASE_PATH}/plan/${params.toString() ? `?${params}` : ""}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  const passBreak = quotes
    .filter((quote) => quote.kind !== "day-tickets" && quote.breakEvenDays != null)
    .sort((a, b) => (a.breakEvenDays ?? 0) - (b.breakEvenDays ?? 0))[0];

  return (
    <div className="page page-narrow">
      <h1>{t("planTitle")}</h1>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
      <div className="seg" role="tablist" aria-label={t("resultsTablist")}>
        <button type="button" role="tab" aria-selected={tab === "plan"} onClick={() => setTab("plan")}>
          {t("myPlanTab")}
        </button>
        <button type="button" role="tab" aria-selected={tab === "prices"} onClick={() => setTab("prices")}>
          {t("passPricesTab")}
        </button>
      </div>
      {tab === "prices" ? <CompareView embedded /> : null}
      {tab === "plan" ? (
        <div className="plan-layout">
          <section className="card-block">
            <div className="chip-row">
              <label className="chip-field">
                <span className="sr-only">{t("pricesFor")}</span>
                <select value={share.age} aria-label={t("ageGroupLabel")} onChange={(event) => updateShare({ age: event.target.value as typeof share.age })}>
                  <option value="adult">{t("ageAdult")}</option>
                  <option value="young-adult">{t("ageYoung")}</option>
                  <option value="youth">{t("ageYouth")}</option>
                  <option value="child">{t("ageChild")}</option>
                </select>
              </label>
              <label className="chip-field">
                <span className="sr-only">{t("purchaseDate")}</span>
                <input type="date" aria-label={t("purchaseDate")} value={effectiveDate ?? ""} onChange={(event) => setPurchaseDate(event.target.value || null)} />
              </label>
            </div>
            {effectiveDate ? <p className="hint">{t("buyOn", { date: formatDate(lang, effectiveDate) })}</p> : null}
            <label className="field">
              <span>{t("birthYearOptional")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1940}
                max={2026}
                value={birthYear ?? ""}
                onChange={(event) => setBirthYear(event.target.value === "" ? null : Number(event.target.value))}
              />
            </label>
            <p className="hint">{t("birthYearExact")}</p>
            <p className="hint">{t("purchaseHelp")}</p>

            <label className="field">
              <span>{t("planSearch")}</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} />
            </label>
            {hits.length > 0 ? (
              <ul className="type-list">
                {hits.map((resort) => (
                  <li key={resort.id}>
                    <button type="button" onClick={() => { setResortDaysCount(resort.id, 1); setQuery(""); }}>
                      {resort.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {totalPlanned === 0 ? <p>{t("planEmpty")}</p> : null}
            <ul className="plan-list">
              {Object.entries(resortDays)
                .sort((a, b) => b[1] - a[1])
                .map(([id, days]) => {
                  const resort = resortById.get(id);
                  if (!resort) return null;
                  return (
                    <li key={id}>
                      <div>
                        <Link href={`/?resort=${encodeURIComponent(id)}`}>{resort.name}</Link>
                        <span className="pass-dots">
                          {resort.passes.slice(0, 3).map((passId) => (
                            <span key={passId} className="pass-dot" style={{ background: passById.get(passId)?.color ?? "#94A3B8" }} title={passById.get(passId)?.name ?? passId} />
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

          <section className="card-block">
            <h2>{t("results")}</h2>
            {!ready || !effectiveDate ? <p>{t("loadingMap")}</p> : null}
            {totalPlanned === 0 ? <p>{t("addDaysPrompt")}</p> : null}
            {best ? (
              <article className="best-card">
                <p className="best-label">{t("bestValue")}</p>
                <h3>{quoteTitle(best, t)}</h3>
                <p className="price-display num">{best.totalEur != null ? formatEur(lang, best.totalEur) : t("unknownTotal")}</p>
                {best.costPerDayEur != null ? <p className="hint">{t("perDay", { amount: formatEur(lang, best.costPerDayEur) })}</p> : null}
                <p>{t("daysCoveredBar", { covered: best.coveredDays, total: totalPlanned })}</p>
                <div className="coverage" aria-hidden="true">
                  <span style={{ width: `${totalPlanned > 0 ? (best.coveredDays / totalPlanned) * 100 : 0}%` }} />
                </div>
                {savings != null && savings > 0 ? <p className="save">{t("youSave", { amount: formatEur(lang, savings) })}</p> : null}
                {best.kind === "day-tickets" ? (
                  <p>
                    {t("dayTicketsWin")}
                    {passBreak?.breakEvenDays != null ? ` ${t("passPaysOffFrom", { n: formatBreakEven(passBreak.breakEvenDays) })}` : ""}
                  </p>
                ) : null}
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
            {others.length > 0 ? <h3>{t("otherOptions")}</h3> : null}
            <ul className="option-list">
              {others.map((quote) => (
                <li key={quote.id}>
                  <button type="button" className="option-row" aria-expanded={openId === quote.id} onClick={() => setOpenId(openId === quote.id ? null : quote.id)}>
                    <span>{quoteTitle(quote, t)}</span>
                    <span className="num">{quote.totalEur != null ? formatEur(lang, quote.totalEur) : t("unknownTotal")}</span>
                  </button>
                  {openId === quote.id ? <Breakdown quote={quote} totalPlanned={totalPlanned} /> : null}
                </li>
              ))}
            </ul>
            <p className="hint">{t("savedLocally")}</p>
            <p className="hint">{t("checkOfficial")}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Breakdown({ quote, totalPlanned }: { quote: PriceQuote; totalPlanned: number }) {
  const { t, lang, setPurchaseDate } = useApp();
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
          {priceReasonText(lang, quote.priceReason, null, quote.nextPeriodStart)}
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

function quoteTitle(quote: PriceQuote, t: (key: "dayTicketsOnly" | "combo", vars?: Record<string, string | number>) => string): string {
  if (quote.kind === "day-tickets") return t("dayTicketsOnly");
  const names = quote.passIds.map((id) => passById.get(id)?.name ?? id).join(" + ");
  return quote.kind === "combo" ? `${t("combo")}: ${names}` : names;
}

function money(lang: "en" | "hu", value: number | null, unknown: string): string {
  const amount = finiteOrBlank(value);
  return amount == null ? unknown : formatEur(lang, amount);
}
