"use client";

import Link from "next/link";
import { legalLinks } from "./legal-links";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

export function Footer() {
  const { t, openCookieSettings } = useApp();
  const href = useLocalizedPath();
  return (
    <footer className="site-footer">
      <nav aria-label={t("siteFooter")}>
        {legalLinks.map((link) => (
          <Link key={link.rest} href={href(link.rest)}>
            {t(link.key)}
          </Link>
        ))}
        <button type="button" className="linkish footer-cookie" onClick={() => openCookieSettings()}>
          {t("cookieSettings")}
        </button>
      </nav>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </footer>
  );
}
