"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { resortById } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";
import type { SheetSnap } from "@/lib/sheet";
import { FilterSheet } from "./FilterSheet";
import { LayersPanel, MapTools } from "./MapTools";
import { ListSheet } from "./ListSheet";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { PlanPill } from "./PlanPill";
import { ResortCard } from "./ResortCard";
import { SearchPill } from "./SearchPill";
import { SettingsLink } from "./SettingsLink";
import { SkiMap } from "./map/SkiMap";
import { useApp } from "./AppState";
import { useNarrow } from "./useNarrow";

export function ExplorerFrame() {
  const { share, selectResort, t, offline, searchAsMove, setSearchAsMove, areaStale, searchThisArea, resortDays, copyLink } = useApp();
  const href = useLocalizedPath();
  const narrow = useNarrow();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [listSnap, setListSnap] = useState<SheetSnap>("peek");
  const [cardSnap, setCardSnap] = useState<SheetSnap>("half");
  const resort = share.resort ? resortById.get(share.resort) : undefined;
  const snap = resort ? cardSnap : listSnap;
  const days = Object.values(resortDays).reduce((sum, value) => sum + value, 0);
  const previousResort = useRef<string | null>(null);

  useEffect(() => {
    setCardSnap("half");
  }, [share.resort]);

  useEffect(() => {
    document.documentElement.dataset.sheet = snap;
    document.documentElement.dataset.panel = resort ? "resort" : "list";
    return () => {
      delete document.documentElement.dataset.sheet;
      delete document.documentElement.dataset.panel;
    };
  }, [snap, resort]);

  useEffect(() => {
    const previous = previousResort.current;
    if (previous && !share.resort) {
      const row = document.getElementById(`resort-${previous}`)?.querySelector("button");
      row?.focus();
    }
    previousResort.current = share.resort;
  }, [share.resort]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select"));
      if (event.key === "Escape") {
        if (layersOpen) setLayersOpen(false);
        else if (filtersOpen) setFiltersOpen(false);
        else if (share.resort) selectResort(null);
        else if (listSnap === "full") setListSnap("half");
        else if (listSnap === "half") setListSnap("peek");
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setFiltersOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen, layersOpen, listSnap, selectResort, share.resort]);

  const compact = narrow && resort && cardSnap === "full" ? { name: resort.name, onBack: () => setCardSnap("half") } : null;

  return (
    <div className="explorer" data-snap={snap} data-panel={resort ? "resort" : "list"}>
      <a className="skip" href="#sheet-host">
        {t("skip")}
      </a>
      {offline ? <p className="offline-banner">{t("offline")}</p> : null}
      <header className="topbar">
        <Link href={href("/")} className="brand desk-brand">
          <span>{SITE_NAME}</span>
        </Link>
        <SearchPill onOpen={() => setFiltersOpen(true)} compact={compact} onShare={copyLink} />
        <nav className="topbar-links" aria-label={t("title")}>
          <Link href={href("/passes")}>{t("passes")}</Link>
          <Link href={href("/plan")}>{days > 0 ? t("myPlanPillPlain", { days }) : t("myPlanLink")}</Link>
          <LanguageSwitcher compact />
          <SettingsLink className="icon-btn" />
        </nav>
        <SettingsLink className="tool-btn topbar-gear" />
      </header>
      <div className="stage">
        <SkiMap />
        <MapTools layersOpen={layersOpen} onLayers={() => setLayersOpen((open) => !open)} />
        <LayersPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
        {areaStale && !resort ? (
          <button type="button" className="area-btn" onClick={searchThisArea}>
            {t("searchThisArea")}
          </button>
        ) : null}
        <label className="move-toggle">
          <input type="checkbox" checked={searchAsMove} onChange={(event) => setSearchAsMove(event.target.checked)} />
          <span>{t("searchAsMove")}</span>
        </label>
        <PlanPill />
      </div>
      <div className="sheet-host" id="sheet-host">
        {resort ? <ResortCard snap={cardSnap} setSnap={setCardSnap} /> : <ListSheet snap={listSnap} setSnap={setListSnap} />}
      </div>
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
