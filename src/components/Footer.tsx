"use client";

import Link from "next/link";
import { legalLinks } from "./MenuDrawer";
import { useApp } from "./AppState";

export function Footer() {
  const { t } = useApp();
  return (
    <footer className="site-footer">
      <nav aria-label={t("siteFooter")}>
        {legalLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            {t(link.key)} <span className="todo-tag">{t("todoMark")}</span>
          </Link>
        ))}
      </nav>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </footer>
  );
}
