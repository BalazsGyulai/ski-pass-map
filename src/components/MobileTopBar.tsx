"use client";

import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";

/** Slim bar above the tab pages on phones: the name and the same gear as the map. Language lives in Settings. */
export function MobileTopBar() {
  const href = useLocalizedPath();
  return (
    <header className="mobile-top">
      <Link href={href("/")} className="brand">
        <span>{SITE_NAME}</span>
      </Link>
      <div className="bar-tools">
        <SettingsLink className="tool-btn" />
      </div>
    </header>
  );
}
