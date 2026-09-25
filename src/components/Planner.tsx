"use client";

import { useMemo } from "react";
import Link from "next/link";
import { passById, passes, resortById, resorts } from "@/lib/data";
import { finiteOrBlank, formatBreakEven, formatDate, formatEur } from "@/lib/format";
import { priceReasonText } from "@/lib/i18n";
import { cheapestFullCoverage, quotePlan, type PriceQuote } from "@/lib/pricing";
import { useApp } from "./AppState";

export function Planner() {
  const {
    t,
    lang,
    birthYear,
    setBirthYear,
    setPurchaseDate,
    effectiveDate,
    resortDays,
    setResortDaysCount,
    clearResortDays,
    ready,
  } = useApp();

  const plan = Object.entries(resortDays).map(([id, days]) => ({ id, days }));
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
        dayTicketEstimate: resort.day_ticket_eur != null && resort.day_ticket_season !== "2025/26",
      })),
      birthYear,
      effectiveDate,
      Object.entries(resortDays).map(([id, days]) => ({ id, days })),
    );
  }, [effectiveDate, birthYear, resortDays]);

  const recommended = cheapestFullCoverage(quotes);
  const totalPlanned = plan.reduce((sum, item) => sum + item.days, 0);

  return (
    <div className="page page-narrow">
      <h1>{t("planTitle")}</h1>
      <p>{t("planIntro")}</p>
      <p className="hint">{t("savedLocally")}</p>
      <p className="hint">{t("checkOfficial")}</p>

      <section className="card-block">
        <div className="split">
          <label className="field">
            <span>{t("birthYear")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1940}
              max={2020}
              value={birthYear ?? ""}
              onChange={(event) => setBirthYear(event.target.value === "" ? null : Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>{t("purchaseDate")}</span>
            <input type="date" value={effectiveDate ?? ""} onChange={(event) => setPurchaseDate(event.target.value || null)} />
          </label>
        </div>
        <p className="hint">{t("birthYearHelp")}</p>
        <p className="hint">{t("purchaseHelp")}</p>
        {effectiveDate ? <p className="hint">{t("onDate", { date: formatDate(lang, effectiveDate) })}</p> : null}
      </section>

      <section className="card-block">
        <h2>{t("plannedDays")}</h2>
        {totalPlanned === 0 ? <p>{t("nonePlanned")}</p> : null}
        <ul className="plan-list">
          {Object.entries(resortDays)
            .sort((a, b) => b[1] - a[1])
            .map(([id, days]) => {
              const resort = resortById.get(id);
              if (!resort) return null;
              return (
                <li key={id}>
                  <Link href={`/?resort=${id}`}>{resort.name}</Link>
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
          </div>
        ) : null}
      </section>

      <section className="card-block">
        <h2>{t("results")}</h2>
        <p className="hint">{t("coverageNote")}</p>
        {!ready || !effectiveDate ? <p>{t("loadingMap")}</p> : null}
        {totalPlanned === 0 ? <p>{t("addDaysPrompt")}</p> : null}
        {recommended ? (
          <p className="banner">
            {t("cheapest")}: {quoteTitle(recommended, t)} · {finiteOrBlank(recommended.totalEur) != null ? formatEur(lang, recommended.totalEur ?? 0) : t("unknownTotal")}
            {recommended.usesEstimate ? ` · ${t("estimate")}` : ""}
          </p>
        ) : totalPlanned > 0 ? (
          <p className="banner warn">{t("noFullCoverage")}</p>
        ) : null}
        <div className="quote-grid">
          {quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} recommended={recommended?.id === quote.id} totalPlanned={totalPlanned} />
          ))}
        </div>
      </section>

      <section className="card-block">
        <h2>{t("assumptions")}</h2>
        <p className="hint">{t("estimateNote")}</p>
        <ul className="source-list">
          {passes.map((pass) => (
            <li key={pass.id}>
              <strong>{pass.name}.</strong> {pass.price_note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function QuoteCard({ quote, recommended, totalPlanned }: { quote: PriceQuote; recommended: boolean; totalPlanned: number }) {
  const { t, lang, setPurchaseDate } = useApp();
  const full = quote.uncoveredDays === 0 && totalPlanned > 0;
  return (
    <article className={recommended ? "quote is-recommended" : "quote"}>
      <h3>{quoteTitle(quote, t)}</h3>
      {recommended ? <p className="badge">{t("cheapest")}</p> : null}
      <p className="hint">{full ? t("fullCover") : totalPlanned > 0 ? t("partialCover") : t("stickerPrices")}</p>
      <dl>
        <div>
          <dt>{t("passPrice")}</dt>
          <dd>{quote.kind === "day-tickets" ? "—" : money(lang, quote.passPriceEur, t("unknown"))}</dd>
        </div>
        <div>
          <dt>{t("coversDays", { covered: quote.coveredDays, total: Math.max(totalPlanned, quote.coveredDays) })}</dt>
          <dd>{t("uncoveredDays", { n: quote.uncoveredDays })}</dd>
        </div>
        <div>
          <dt>{t("uncoveredTicket")}</dt>
          <dd>{quote.uncoveredDays === 0 ? "—" : money(lang, quote.uncoveredDayTicketEur, t("unknown"))}</dd>
        </div>
        <div>
          <dt>{t("total")}</dt>
          <dd>
            {money(lang, quote.totalEur, t("unknownTotal"))}
            {quote.usesEstimate && quote.totalEur != null ? ` · ${t("estimate")}` : ""}
          </dd>
        </div>
        <div>
          <dt>{t("costPerDay")}</dt>
          <dd>{quote.costPerDayEur == null ? t("unknown") : formatEur(lang, quote.costPerDayEur)}</dd>
        </div>
        <div>
          <dt>{t("breakEven")}</dt>
          <dd>
            {quote.breakEvenDays != null
              ? `${t("breakEvenMix", { n: formatBreakEven(quote.breakEvenDays) })}${quote.breakEvenEstimate ? ` · ${t("estimate")}` : ""}`
              : t("breakEvenMixUnknown")}
          </dd>
        </div>
      </dl>
      {quote.priceReason && quote.passPriceEur == null ? (
        <p className="hint warn">
          {priceReasonText(lang, quote.priceReason, null, quote.nextPeriodStart)}
          {quote.nextPeriodStart ? (
            <>
              {" "}
              <button type="button" className="ghost" onClick={() => setPurchaseDate(quote.nextPeriodStart)}>
                {t("useThisDate", { date: formatDate(lang, quote.nextPeriodStart) })}
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {quote.passIds.length > 0 ? (
        <ul className="mini-passes">
          {quote.passIds.map((id) => {
            const pass = passById.get(id);
            if (!pass) return null;
            return (
              <li key={id}>
                <span className="swatch" style={{ background: pass.color }} /> {pass.name}
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}

function quoteTitle(quote: PriceQuote, t: (key: "dayTicketsOnly" | "combo" | "passPrice", vars?: Record<string, string | number>) => string): string {
  if (quote.kind === "day-tickets") return t("dayTicketsOnly");
  const names = quote.passIds.map((id) => passById.get(id)?.name ?? id).join(" + ");
  return quote.kind === "combo" ? `${t("combo")}: ${names}` : names;
}

function money(lang: "en" | "hu", value: number | null, unknown: string): string {
  const amount = finiteOrBlank(value);
  return amount == null ? unknown : formatEur(lang, amount);
}
