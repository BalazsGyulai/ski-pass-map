"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { TermsEn, TermsHu } from "@/lib/legal/terms";
import { useApp } from "@/components/AppState";
import { pathWithLang } from "@/i18n/routing";

export function TermsContent() {
  const { lang } = useApp();
  const locale = pickLegalLocale(lang);
  // The legal text links with a plain anchor, so the path carries the base path.
  const rankingPath = pathWithLang(lang, "/resort-ranking");
  const body = locale === "hu" ? <TermsHu rankingPath={rankingPath} /> : <TermsEn rankingPath={rankingPath} />;
  return (
    <LegalShell titleKey="terms" locale={locale}>
      {body}
    </LegalShell>
  );
}
