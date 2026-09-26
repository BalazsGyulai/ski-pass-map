"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_CONFIG } from "@/lib/config/legal";
import { useApp } from "@/components/AppState";
import { useLocalizedPath } from "@/components/LanguageSwitcher";
import type { MessageKey } from "@/lib/i18n";
import type { Lang } from "@/i18n/languages";

export function LegalShell({
  titleKey,
  children,
  locale,
}: {
  titleKey: MessageKey;
  children: ReactNode;
  locale: "en" | "hu" | "fallback";
}) {
  const { t, lang } = useApp();
  const href = useLocalizedPath();
  const showDraft = LEGAL_CONFIG.draft;
  const showFallback = locale === "fallback" && lang !== "en" && lang !== "hu";

  return (
    <div className="page page-narrow legal-page">
      {showDraft ? <p className="legal-draft-banner" role="status">{t("legalDraftBanner")}</p> : null}
      {showFallback ? <p className="hint">{t("legalFallbackNote")}</p> : null}
      <h1>{t(titleKey)}</h1>
      <div className="legal-body">{children}</div>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
      <nav className="legal-crosslinks" aria-label={t("legalCrosslinks")}>
        <Link href={href("/imprint")}>{t("imprint")}</Link>
        <Link href={href("/privacy")}>{t("privacy")}</Link>
        <Link href={href("/terms")}>{t("terms")}</Link>
        <Link href={href("/resort-ranking")}>{t("rankingTitle")}</Link>
        <Link href={href("/credits")}>{t("creditsTitle")}</Link>
        <Link href={href("/contact")}>{t("contact")}</Link>
      </nav>
    </div>
  );
}

export function pickLegalLocale(lang: Lang): "en" | "hu" | "fallback" {
  if (lang === "hu") return "hu";
  if (lang === "en") return "en";
  return "fallback";
}
