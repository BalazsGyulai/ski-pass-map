"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { RankingEn, RankingHu } from "@/lib/legal/terms";
import { useApp } from "@/components/AppState";

export function RankingContent() {
  const { lang } = useApp();
  const locale = pickLegalLocale(lang);
  const body = locale === "hu" ? <RankingHu /> : <RankingEn />;
  return (
    <LegalShell titleKey="rankingTitle" locale={locale}>
      {body}
    </LegalShell>
  );
}
