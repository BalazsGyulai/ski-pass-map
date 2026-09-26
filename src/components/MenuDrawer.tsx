"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { BirthYearField } from "./BirthYearField";
import { IconClose } from "./icons";
import { useApp } from "./AppState";

const mainLinks = [
  { href: "/plan", key: "myPlanLink" as const },
  { href: "/compare", key: "navCompare" as const },
  { href: "/about", key: "navAboutSources" as const },
];

const legalLinks = [
  { href: "/imprint", key: "imprint" as const },
  { href: "/privacy", key: "privacy" as const },
  { href: "/terms", key: "terms" as const },
  { href: "/credits", key: "creditsTitle" as const },
  { href: "/contact", key: "contact" as const },
  { href: "/support", key: "supportSkimap" as const },
];

export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, share, updateShare, theme, setTheme } = useApp();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="scrim">
      <button type="button" className="scrim-hit" aria-label={t("closeMenu")} onClick={onClose} />
      <div id="site-menu" className="menu-drawer" role="dialog" aria-modal="true" aria-label={t("menuTitle")}>
        <div className="drawer-head">
          <strong>{SITE_NAME}</strong>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label={t("closeMenu")}>
            <IconClose />
          </button>
        </div>
        <p className="disclaimer">{t("globalDisclaimer")}</p>
        <nav className="drawer-nav" aria-label={t("menuTitle")}>
          {mainLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={onClose}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="drawer-tools">
          <div className="lang-toggle" role="group" aria-label={t("langLabel")}>
            <button type="button" aria-pressed={share.lang === "en"} onClick={() => updateShare({ lang: "en" })}>
              {t("langEn")}
            </button>
            <button type="button" aria-pressed={share.lang === "hu"} onClick={() => updateShare({ lang: "hu" })}>
              {t("langHu")}
            </button>
          </div>
          <BirthYearField />
          <label className="field">
            <span>{t("theme")}</span>
            <select value={theme} onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")}>
              <option value="system">{t("themeSystem")}</option>
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </select>
          </label>
        </div>
        <nav className="drawer-legal" aria-label={t("siteFooter")}>
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={onClose}>
              {t(link.key)} <span className="todo-tag">{t("todoMark")}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export { legalLinks };
