"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { TermsEn, TermsHu } from "@/lib/legal/terms";
import { useApp } from "@/components/AppState";
import { useLocalizedPath } from "@/components/LanguageSwitcher";

export function TermsContent() {
  const { lang } = useApp();
  const href = useLocalizedPath();
  const locale = pickLegalLocale(lang);
  const rankingPath = href("/resort-ranking");
  const body = locale === "hu" ? <TermsHu rankingPath={rankingPath} /> : <TermsEn rankingPath={rankingPath} />;
  return (
    <LegalShell titleKey="terms" locale={locale}>
      {body}
    </LegalShell>
  );
}
