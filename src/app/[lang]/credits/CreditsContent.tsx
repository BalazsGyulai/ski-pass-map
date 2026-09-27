"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { DataSourcesEn, DataSourcesHu } from "@/lib/legal/data-sources";
import { useApp } from "@/components/AppState";
import { SITE_NAME } from "@/lib/site";

export function CreditsContent() {
  const { t, lang } = useApp();
  const locale = pickLegalLocale(lang);
  const body = locale === "hu" ? <DataSourcesHu /> : <DataSourcesEn />;
  return (
    <LegalShell titleKey="creditsTitle" locale={locale}>
      {body}
      <p className="hint">{t("creditsCode", { name: SITE_NAME })}</p>
    </LegalShell>
  );
}
