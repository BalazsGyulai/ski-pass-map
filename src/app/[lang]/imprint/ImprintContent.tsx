"use client";

import { LegalShell, pickLegalLocale } from "@/components/legal/LegalShell";
import { ImprintEn, ImprintHu } from "@/lib/legal/imprint";
import { useApp } from "@/components/AppState";
import { pathWithLang } from "@/i18n/routing";

export function ImprintContent() {
  const { lang } = useApp();
  const locale = pickLegalLocale(lang);
  // The legal text links with a plain anchor, so the path carries the base path.
  const contactPath = pathWithLang(lang, "/contact");
  const body = locale === "hu" ? <ImprintHu contactPath={contactPath} /> : <ImprintEn contactPath={contactPath} />;
  return (
    <LegalShell titleKey="imprint" locale={locale}>
      {body}
    </LegalShell>
  );
}
