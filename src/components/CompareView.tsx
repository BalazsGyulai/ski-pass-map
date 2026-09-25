"use client";

import { passes, resorts } from "@/lib/data";
import { daysUntil, formatDate, formatEur } from "@/lib/format";
import { bracketLabel, deadlineLabel, priceReasonText } from "@/lib/i18n";
import { pricesOnDate, resolvePrice } from "@/lib/pricing";
import { useApp } from "./AppState";

export function CompareView() {
  const { t, lang, birthYear, effectiveDate, today } = useApp();
  const events = passes
    .flatMap((pass) => pass.deadlines.map((deadline) => ({ ...deadline, pass })))
    .sort((a, b) => a.date.localeCompare(b.date) || a.pass.name.localeCompare(b.pass.name));

  return (
    <div className="page">
      <h1>{t("compareTitle")}</h1>
      <p>{t("compareIntro")}</p>
      <p className="hint">{t("checkOfficial")}</p>
      {effectiveDate ? <p className="hint">{t("onDate", { date: formatDate(lang, effectiveDate) })}</p> : null}
      {!birthYear ? <p className="hint">{t("setBirthYearHint")}</p> : null}

      <div className="table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th>{t("passes")}</th>
              <th>{t("yourColumn")}</th>
              <th>{t("tariffsColumn")}</th>
              <th>{t("resorts")}</th>
              <th>{t("deadlineColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {passes.map((pass) => {
              const yours = effectiveDate ? resolvePrice(pass, birthYear, effectiveDate) : null;
              const tariffs = effectiveDate ? pricesOnDate(pass, effectiveDate) : [];
              const covered = resorts.filter((resort) => resort.passes.includes(pass.id));
              const next = today
                ? pass.deadlines
                    .map((deadline) => ({ ...deadline, days: daysUntil(today, deadline.date) }))
                    .filter((deadline) => deadline.days >= 0)
                    .sort((a, b) => a.days - b.days)[0]
                : undefined;
              return (
                <tr key={pass.id}>
                  <td data-label={t("passes")}>
                    <span className="name-line">
                      <span className="swatch" style={{ background: pass.color }} />
                      <strong>{pass.name}</strong>
                    </span>
                    <a href={pass.url} target="_blank" rel="noreferrer">
                      {t("officialSite")}
                    </a>
                  </td>
                  <td data-label={t("yourColumn")}>
                    {yours?.amountEur != null ? (
                      <>
                        {formatEur(lang, yours.amountEur)}
                        {yours.bracketId ? ` · ${bracketLabel(lang, yours.bracketId, yours.bracketLabel ?? "")}` : ""}
                      </>
                    ) : yours ? (
                      priceReasonText(lang, yours.reason, yours.bracketId, yours.nextPeriodStart)
                    ) : (
                      t("unknown")
                    )}
                  </td>
                  <td data-label={t("tariffsColumn")}>
                    <ul className="mini-passes">
                      {tariffs.map((tariff) => (
                        <li key={tariff.bracketId}>
                          {bracketLabel(lang, tariff.bracketId, tariff.bracketLabel)}:{" "}
                          {tariff.amountEur != null
                            ? formatEur(lang, tariff.amountEur)
                            : priceReasonText(lang, tariff.reason, tariff.bracketId, tariff.nextPeriodStart)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td data-label={t("resorts")}>
                    <details>
                      <summary>{t("resortsCovered", { n: covered.length })}</summary>
                      <ul>
                        {covered.map((resort) => (
                          <li key={resort.id}>{resort.name}</li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  <td data-label={t("deadlineColumn")}>
                    {next ? (
                      <>
                        {formatDate(lang, next.date)} · {deadlineLabel(lang, next.id, next.label)} · {countdownText(t, next.kind, next.days)}
                      </>
                    ) : (
                      t("noDeadline")
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>{t("timeline")}</h2>
      <ol className="timeline">
        {events.map((event) => {
          const days = today ? daysUntil(today, event.date) : null;
          const state = days == null ? "" : days > 0 ? "future" : days === 0 ? "today" : "past";
          return (
            <li key={event.id} className={`timeline-item ${state}`}>
              <span className="swatch" style={{ background: event.pass.color }} />
              <div>
                <strong>{deadlineLabel(lang, event.id, event.label)}</strong>
                <p>{event.pass.name}</p>
                <p className="hint">
                  {formatDate(lang, event.date)}
                  {days != null ? ` · ${countdownText(t, event.kind, days)}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function countdownText(
  t: (key: "endsIn" | "startsIn" | "ended" | "endsToday" | "startsToday" | "started", vars?: Record<string, string | number>) => string,
  kind: "starts" | "ends",
  days: number,
): string {
  if (kind === "ends" && days > 0) return t("endsIn", { n: days });
  if (kind === "ends" && days === 0) return t("endsToday");
  if (kind === "ends") return t("ended");
  if (days > 0) return t("startsIn", { n: days });
  if (days === 0) return t("startsToday");
  return t("started");
}
