"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";
import { useApp } from "./AppState";
import { isCurrentTab, primaryTabs } from "./nav-links";

export function Header() {
  const pathname = usePathname();
  const { t } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(pathname);
  const onSettings = rest === "/settings" || rest.startsWith("/settings/");
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        {t("skip")}
      </a>
      <div className="bar">
        <Link href={href("/")} className="brand">
          <span>{SITE_NAME}</span>
          <small>{t("season")}</small>
        </Link>
        <nav className="primary-nav" aria-label={t("title")}>
          {primaryTabs.map((link) => (
            <Link key={link.rest} href={href(link.rest)} aria-current={isCurrentTab(rest, link.rest) ? "page" : undefined}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="bar-tools">
          {onSettings ? null : <LanguageSwitcher compact />}
          <SettingsLink className="icon-btn" />
        </div>
      </div>
    </header>
  );
}
