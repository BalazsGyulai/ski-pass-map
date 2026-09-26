"use client";

import { passById } from "@/lib/data";
import { regionLabel, type MessageKey } from "@/lib/i18n";
import type { AgeCategory } from "@/lib/age";
import { IconClose, IconFilter, IconMenu } from "./icons";
import { useApp } from "./AppState";

const ageKey: Record<AgeCategory, MessageKey> = {
  adult: "ageAdult",
  "young-adult": "ageYoung",
  youth: "ageYouth",
  child: "ageChild",
};

export function SearchPill({
  onMenu,
  onOpen,
  menuOpen,
  compact,
  onShare,
}: {
  onMenu: () => void;
  onOpen: () => void;
  menuOpen: boolean;
  compact?: { name: string; onBack: () => void } | null;
  onShare?: () => void;
}) {
  const { t, share, activeFilterCount, home, lang } = useApp();

  if (compact) {
    return (
      <div className="search-pill is-compact">
        <button type="button" className="pill-btn" onClick={compact.onBack} aria-label={t("backToList")}>
          ‹
        </button>
        <p className="pill-copy">
          <span className="pill-title">{compact.name}</span>
        </p>
        <button type="button" className="pill-btn" onClick={onShare}>
          {t("share")}
        </button>
      </div>
    );
  }

  return (
    <div className="search-pill">
      <button type="button" className="pill-btn" aria-expanded={menuOpen} aria-controls="site-menu" onClick={onMenu} aria-label={t("openMenu")}>
        <IconMenu />
      </button>
      <button type="button" className="pill-copy" onClick={onOpen}>
        <span className="pill-title">{t("searchPillLabel")}</span>
        <span className="pill-summary">{summaryLine()}</span>
      </button>
      <button type="button" className="pill-btn" onClick={onOpen} aria-label={activeFilterCount > 0 ? t("filterCountBadge", { n: activeFilterCount }) : t("openFilters")}>
        <IconFilter />
        {activeFilterCount > 0 ? <span className="count-badge">{activeFilterCount}</span> : null}
      </button>
    </div>
  );

  function summaryLine(): string {
    const parts: string[] = [];
    if (share.noPass) parts.push(t("noPassShort"));
    else if (share.passes.length === 1) parts.push(passById.get(share.passes[0])?.name ?? t("anyPass"));
    else if (share.passes.length > 1) parts.push(t("passesSelected", { n: share.passes.length }));
    else parts.push(t("anyPass"));
    parts.push(t(ageKey[share.age]));
    if (share.night) parts.push(t("nightSkiing"));
    if (share.park) parts.push(t("snowpark"));
    if (share.transit) parts.push(t("transportNote"));
    if (share.favouritesOnly) parts.push(t("favouritesOnly"));
    if (share.showAbandoned) parts.push(t("statusClosed"));
    if (share.regions.length > 0) parts.push(share.regions.map((region) => regionLabel(lang, region)).join(", "));
    if (home && home.label !== "geo") parts.push(t("fromPlace", { place: home.label }));
    else if (share.home === "geo") parts.push(t("fromPlace", { place: t("homeGeo") }));
    return parts.join(" · ");
  }
}

export function IconBackClose() {
  return <IconClose />;
}
