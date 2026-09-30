"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";

/** Slim bar above the tab pages on phones: the name, language, and the same gear as the map. */
export function MobileTopBar() {
  const href = useLocalizedPath();
  const { rest } = parseLangPath(usePathname());
  const onSettings = rest === "/settings" || rest.startsWith("/settings/");
  return (
    <header className="mobile-top">
      <Link href={href("/")} className="brand">
        <span>{SITE_NAME}</span>
      </Link>
      <div className="bar-tools">
        {onSettings ? null : <LanguageSwitcher compact />}
        <SettingsLink className="tool-btn" />
      </div>
    </header>
  );
}
