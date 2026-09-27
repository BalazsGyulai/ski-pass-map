"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatEur } from "@/lib/format";
import { bestPlanOption, planQuotes, quoteTitle } from "@/lib/plan-quotes";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

/** Live answer on the map: the cheapest way to ski the days you planned. Opens My plan. */
export function PlanPill() {
  const { t, lang, resortDays, birthYear, effectiveDate } = useApp();
  const href = useLocalizedPath();
  const total = Object.values(resortDays).reduce((sum, days) => sum + days, 0);
  const answer = useMemo(() => {
    if (!effectiveDate || total < 1) return null;
    return bestPlanOption(planQuotes(birthYear, effectiveDate, resortDays));
  }, [effectiveDate, total, birthYear, resortDays]);

  if (total < 1) return null;
  const best = answer?.best ?? null;
  return (
    <Link className="plan-pill" href={href("/plan")}>
      <span className="plan-pill-days num" aria-hidden="true">
        {total}
      </span>
      <span className="plan-pill-text">
        <span className="plan-pill-label">{t("myPlanPillPlain", { days: total })}</span>
        {best?.totalEur != null ? (
          <strong>
            {quoteTitle(best, t)} · {formatEur(lang, best.totalEur)}
          </strong>
        ) : null}
        {answer?.savings != null && answer.savings > 0 ? <span className="save">{t("youSave", { amount: formatEur(lang, answer.savings) })}</span> : null}
      </span>
      <span className="plan-pill-chevron" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}
