"use client";

import Link from "next/link";
import { legalLinks } from "./MenuDrawer";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

export function Footer() {
  const { t } = useApp();
  const href = useLocalizedPath();
  return (
    <footer className="site-footer">
      <nav aria-label={t("siteFooter")}>
        {legalLinks.map((link) => (
          <Link key={link.rest} href={href(link.rest)}>
            {t(link.key)}
            {link.todo ? <span className="todo-tag">{t("todoMark")}</span> : null}
          </Link>
        ))}
      </nav>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </footer>
  );
}
