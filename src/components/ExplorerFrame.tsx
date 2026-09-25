"use client";

import { useEffect } from "react";
import { Filters } from "./Filters";
import { MapSlot } from "./MapSlot";
import { ResortDetail } from "./ResortDetail";
import { ResortList } from "./ResortList";
import { useApp } from "./AppState";

export function ExplorerFrame() {
  const { share, updateShare, selectResort, activeFilterCount, t, offline } = useApp();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select"));
      if (event.key === "Escape") selectResort(null);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        document.getElementById("resort-search")?.focus();
        if (window.matchMedia("(max-width: 899px)").matches) updateShare({ view: "filters" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectResort, updateShare]);

  return (
    <div className={`explorer view-${share.view}`}>
      {offline ? <p className="offline-banner">{t("offline")}</p> : null}
      <Filters />
      <div className="map-col">
        <MapSlot />
      </div>
      <div className="list-wrap">
        <ResortList />
      </div>
      {share.resort ? <ResortDetail /> : null}
      <nav className="bottom-nav" aria-label={t("viewLabel")}>
        <button type="button" aria-pressed={share.view === "map"} onClick={() => updateShare({ view: "map" })}>
          {t("showMap")}
        </button>
        <button type="button" aria-pressed={share.view === "list"} onClick={() => updateShare({ view: "list" })}>
          {t("showList")}
        </button>
        <button type="button" aria-pressed={share.view === "filters"} onClick={() => updateShare({ view: "filters" })}>
          {activeFilterCount > 0 ? t("filterCountShort", { n: activeFilterCount }) : t("showFilters")}
        </button>
      </nav>
    </div>
  );
}
