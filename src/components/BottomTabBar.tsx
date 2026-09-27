"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { IconHeart, IconMap, IconPlan, IconSettings } from "./icons";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

const tabs = [
  { rest: "/", key: "navMap" as const, Icon: IconMap },
  { rest: "/plan", key: "navPlan" as const, Icon: IconPlan },
  { rest: "/saved", key: "navSaved" as const, Icon: IconHeart },
  { rest: "/settings", key: "navSettings" as const, Icon: IconSettings },
];

function isCurrent(rest: string, tabRest: string): boolean {
  if (tabRest === "/") return rest === "/";
  return rest === tabRest || rest.startsWith(`${tabRest}/`);
}

export function BottomTabBar() {
  const pathname = usePathname();
  const { t } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(pathname);
  return (
    <nav className="bottom-tab-bar" aria-label={t("title")}>
      {tabs.map((tab) => {
        const current = isCurrent(rest, tab.rest);
        return (
          <Link key={tab.rest} href={href(tab.rest)} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined}>
            <tab.Icon />
            <span>{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
