"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppState";

const links = [
  { href: "/", key: "navMap" as const },
  { href: "/compare", key: "navCompare" as const },
  { href: "/plan", key: "navPlan" as const },
  { href: "/about", key: "navAbout" as const },
];

export function Header() {
  const pathname = usePathname();
  const { t, share, updateShare, theme, setTheme, copyLink, copyMessage } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="site-header">
      <a className="skip" href="#main">
        {t("skip")}
      </a>
      <div className="bar">
        <Link href="/" className="brand">
          <span>{t("title")}</span>
          <small>{t("season")}</small>
        </Link>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {t("menu")}
        </button>
        <div id="site-menu" className={menuOpen ? "header-menu is-open" : "header-menu"}>
          <nav className="primary-nav" aria-label={t("title")}>
            {links.map((link) => {
              const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} aria-current={current ? "page" : undefined}>
                  {t(link.key)}
                </Link>
              );
            })}
          </nav>
          <div className="tools">
            <div className="lang-toggle" role="group" aria-label={t("langLabel")}>
              <button type="button" aria-pressed={share.lang === "en"} onClick={() => updateShare({ lang: "en" })}>
                {t("langEn")}
              </button>
              <button type="button" aria-pressed={share.lang === "hu"} onClick={() => updateShare({ lang: "hu" })}>
                {t("langHu")}
              </button>
            </div>
            <label className="theme-label">
              <span className="sr-only">{t("theme")}</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")} aria-label={t("theme")}>
                <option value="system">{t("themeSystem")}</option>
                <option value="light">{t("themeLight")}</option>
                <option value="dark">{t("themeDark")}</option>
              </select>
            </label>
            <button type="button" className="ghost" onClick={copyLink}>
              {copyMessage ?? t("copyLink")}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
