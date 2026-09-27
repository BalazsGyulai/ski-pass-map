"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { IconSettings } from "./icons";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

/** The gear that opens Settings. It replaces the old Settings tab. */
export function SettingsLink({ className }: { className: string }) {
  const { t } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(usePathname());
  const current = rest === "/settings" || rest.startsWith("/settings/");
  return (
    <Link href={href("/settings")} className={className} aria-label={t("navSettings")} aria-current={current ? "page" : undefined} title={t("navSettings")}>
      <IconSettings />
    </Link>
  );
}
