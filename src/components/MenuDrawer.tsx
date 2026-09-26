"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { BirthYearField } from "./BirthYearField";
import { IconClose } from "./icons";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

export const mainLinks = [
  { rest: "/plan", key: "myPlanLink" as const },
  { rest: "/compare", key: "navCompare" as const },
  { rest: "/about", key: "navAboutSources" as const },
];

export const legalLinks = [
  { rest: "/imprint", key: "imprint" as const, todo: true },
  { rest: "/privacy", key: "privacy" as const, todo: true },
  { rest: "/terms", key: "terms" as const, todo: true },
  { rest: "/credits", key: "creditsTitle" as const, todo: true },
  { rest: "/contact", key: "contact" as const, todo: false },
  { rest: "/support", key: "supportSkimap" as const, todo: true },
];

export function MenuDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, theme, setTheme } = useApp();
  const href = useLocalizedPath();
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
            <Link key={link.rest} href={href(link.rest)} onClick={onClose}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="drawer-tools">
          <LanguageSwitcher compact />
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
            <Link key={link.rest} href={href(link.rest)} onClick={onClose}>
              {t(link.key)}
              {link.todo ? <span className="todo-tag">{t("todoMark")}</span> : null}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
