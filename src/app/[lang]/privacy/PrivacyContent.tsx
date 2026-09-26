"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { PrivacyEn, PrivacyHu } from "@/lib/legal/privacy";
import { useApp } from "@/components/AppState";

export function PrivacyContent() {
  const { lang } = useApp();
  const locale = pickLegalLocale(lang);
  const body = locale === "hu" ? <PrivacyHu /> : <PrivacyEn />;
  return (
    <LegalShell titleKey="privacy" locale={locale}>
      {body}
    </LegalShell>
  );
}
