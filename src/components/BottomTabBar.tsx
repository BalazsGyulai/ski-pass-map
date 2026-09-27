"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { isCurrentTab, primaryTabs } from "./nav-links";

export function BottomTabBar() {
  const pathname = usePathname();
  const { t, resortDays } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(pathname);
  const days = Object.values(resortDays).reduce((sum, value) => sum + value, 0);
  return (
    <nav className="bottom-tab-bar" aria-label={t("title")}>
      {primaryTabs.map((tab) => {
        const current = isCurrentTab(rest, tab.rest);
        return (
          <Link key={tab.rest} href={href(tab.rest)} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined}>
            <span className="tab-icon">
              <tab.Icon />
              {tab.rest === "/plan" && days > 0 ? (
                <span className="tab-badge num" aria-hidden="true">
                  {days}
                </span>
              ) : null}
            </span>
            <span>{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
