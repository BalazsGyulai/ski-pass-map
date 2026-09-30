"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { IconSettings } from "./icons";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

/** The gear that opens Settings, and returns to the map when Settings is already open. */
export function SettingsLink({ className }: { className: string }) {
  const { t } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(usePathname());
  const onSettings = rest === "/settings" || rest.startsWith("/settings/");
  const label = onSettings ? t("backToMap") : t("navSettings");
  return (
    <Link href={onSettings ? href("/") : href("/settings")} className={className} aria-label={label} title={label}>
      <IconSettings />
    </Link>
  );
}
