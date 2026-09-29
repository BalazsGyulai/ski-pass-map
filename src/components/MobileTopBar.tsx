"use client";

import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";

/** Slim bar above the tab pages on phones: the name, language, and the gear for Settings. */
export function MobileTopBar() {
  const href = useLocalizedPath();
  return (
    <header className="mobile-top">
      <Link href={href("/")} className="brand">
        <span>{SITE_NAME}</span>
      </Link>
      <div className="bar-tools">
        <LanguageSwitcher compact />
        <SettingsLink className="icon-btn" />
      </div>
    </header>
  );
}
