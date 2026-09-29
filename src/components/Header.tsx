"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";
import { useApp } from "./AppState";
import { isCurrentTab, primaryTabs } from "./nav-links";

/** The map's desktop bar, without the search field. Map sits left of Passes. */
export function Header() {
  const pathname = usePathname();
  const { t, resortDays } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(pathname);
  const days = Object.values(resortDays).reduce((sum, value) => sum + value, 0);
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        {t("skip")}
      </a>
      <div className="topbar">
        <Link href={href("/")} className="brand desk-brand">
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="topbar-links" aria-label={t("title")}>
          {primaryTabs.map((link) => (
            <Link key={link.rest} href={href(link.rest)} aria-current={isCurrentTab(rest, link.rest) ? "page" : undefined}>
              {link.rest === "/plan" && days > 0 ? t("myPlanPillPlain", { days }) : t(link.key)}
            </Link>
          ))}
          <LanguageSwitcher compact />
          <SettingsLink className="icon-btn" />
        </nav>
      </div>
    </header>
  );
}
