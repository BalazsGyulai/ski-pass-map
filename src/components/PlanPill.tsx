"use client";

import Link from "next/link";
import { passes, resorts } from "@/lib/data";
import { formatEur } from "@/lib/format";
import { dayTicketIsEstimate, quotePlan } from "@/lib/pricing";
import { useMemo } from "react";
import { useApp } from "./AppState";

export function PlanPill() {
  const { t, lang, resortDays, birthYear, effectiveDate } = useApp();
  const total = Object.values(resortDays).reduce((sum, days) => sum + days, 0);
  const best = useMemo(() => {
    if (!effectiveDate || total < 1) return null;
    const quotes = quotePlan(
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
    );
    const priced = quotes.filter((quote) => quote.totalEur != null);
    priced.sort((a, b) => (a.totalEur ?? 0) - (b.totalEur ?? 0));
    return priced[0] ?? null;
  }, [effectiveDate, total, birthYear, resortDays]);

  if (total < 1) return null;
  const label =
    best?.totalEur != null ? t("myPlanPill", { days: total, price: formatEur(lang, best.totalEur) }) : t("myPlanPillPlain", { days: total });
  return (
    <Link className="plan-pill" href="/plan">
      {label}
    </Link>
  );
}
