"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { ImprintEn, ImprintHu } from "@/lib/legal/imprint";
import { useApp } from "@/components/AppState";
import { useLocalizedPath } from "@/components/LanguageSwitcher";

export function ImprintContent() {
  const { lang } = useApp();
  const href = useLocalizedPath();
  const locale = pickLegalLocale(lang);
  const contactPath = href("/contact");
  const body = locale === "hu" ? <ImprintHu contactPath={contactPath} /> : <ImprintEn contactPath={contactPath} />;
  return (
    <LegalShell titleKey="imprint" locale={locale}>
      {body}
    </LegalShell>
  );
}
