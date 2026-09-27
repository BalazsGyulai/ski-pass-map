"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

const links = [
  { rest: "/", key: "navMap" as const },
  { rest: "/plan", key: "navPlan" as const },
  { rest: "/saved", key: "navSaved" as const },
  { rest: "/settings", key: "navSettings" as const },
];

function navIsCurrent(rest: string, linkRest: string): boolean {
  if (linkRest === "/") return rest === "/";
  return rest === linkRest || rest.startsWith(`${linkRest}/`);
}

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
          {links.map((link) => (
            <Link key={link.rest} href={href(link.rest)} aria-current={navIsCurrent(rest, link.rest) ? "page" : undefined}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
        {onSettings ? null : <LanguageSwitcher compact />}
      </div>
    </header>
  );
}
