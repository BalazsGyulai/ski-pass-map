"use client";

import Link from "next/link";
import { getAffiliateLinks, hasAffiliateLinks } from "@/lib/affiliates";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { ExternalSiteLink } from "./ExternalSiteLink";

export function AffiliateLinksBlock() {
  const { t } = useApp();
  const href = useLocalizedPath();
  if (!hasAffiliateLinks()) return null;
  const links = getAffiliateLinks();
  return (
    <section className="affiliate-block" data-testid="affiliate-block">
      <h3>{t("affiliatePartnerLinks")}</h3>
      <ul className="affiliate-list">
        {links.map((item) => (
          <li key={`${item.category}-${item.url}`}>
            <span className="affiliate-label">{t("affiliateAdLabel")}</span>
            <ExternalSiteLink href={item.url} rel="sponsored noopener noreferrer">{item.label}</ExternalSiteLink>
          </li>
        ))}
      </ul>
      <p className="hint">
        {t("affiliateDisclosure")}{" "}
        <Link href={href("/privacy")}>{t("privacy")}</Link>
        {" · "}
        <Link href={href("/terms")}>{t("terms")}</Link>
      </p>
    </section>
  );
}
