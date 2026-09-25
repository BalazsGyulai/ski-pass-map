"use client";

import { useEffect, useState } from "react";
import { passes } from "@/lib/data";
import { Filters } from "./Filters";
import { MapSlot } from "./MapSlot";
import { ResortDetail } from "./ResortDetail";
import { ResortList } from "./ResortList";
import { useApp } from "./AppState";

export function ExplorerFrame() {
  const { share, updateShare, selectResort, activeFilterCount, t, offline } = useApp();
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select"));
      if (event.key === "Escape") {
        if (filtersOpen) setFiltersOpen(false);
        else if (share.view === "filters") updateShare({ view: "map" });
        else selectResort(null);
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        const search = document.getElementById("resort-search");
        const panel = document.getElementById("resort-search-filters");
        const visible = search && search.getClientRects().length > 0 ? search : panel;
        visible?.focus();
        if (window.matchMedia("(max-width: 899px)").matches && visible === panel) updateShare({ view: "filters" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectResort, updateShare, filtersOpen, share.view]);

  function openFilters() {
    if (window.matchMedia("(max-width: 899px)").matches) updateShare({ view: "filters" });
    else setFiltersOpen(true);
  }

  function closeFilters() {
    setFiltersOpen(false);
    if (window.matchMedia("(max-width: 899px)").matches) updateShare({ view: "map" });
  }

  return (
    <div className={`explorer view-${share.view}${filtersOpen ? " filters-open" : ""}`}>
      {offline ? <p className="offline-banner">{t("offline")}</p> : null}
      <div className="map-col">
        <MapSlot />
      </div>
      <aside className="dock">
        <div className="float-bar">
          <label className="search-field">
            <span className="sr-only">{t("searchLabel")}</span>
            <input
              id="resort-search"
              type="search"
              value={share.q}
              placeholder={t("searchPlaceholder")}
              onChange={(event) => updateShare({ q: event.target.value })}
            />
          </label>
          <div className="chips" role="toolbar" aria-label={t("filters")}>
            {passes.map((pass) => {
              const on = share.passes.includes(pass.id);
              return (
                <button
                  key={pass.id}
                  type="button"
                  className={on ? "chip is-on" : "chip"}
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? share.passes.filter((id) => id !== pass.id) : [...share.passes, pass.id];
                    updateShare({ passes: next, noPass: false });
                  }}
                >
                  <span className="swatch" style={{ background: pass.color }} />
                  {pass.name}
                </button>
              );
            })}
            <button type="button" className={share.park ? "chip is-on" : "chip"} aria-pressed={share.park} onClick={() => updateShare({ park: !share.park })}>
              {t("snowpark")}
            </button>
            <button type="button" className={share.night ? "chip is-on" : "chip"} aria-pressed={share.night} onClick={() => updateShare({ night: !share.night })}>
              {t("nightSkiing")}
            </button>
            <button
              type="button"
              className={share.showAbandoned ? "chip is-on" : "chip"}
              aria-pressed={share.showAbandoned}
              onClick={() => updateShare({ showAbandoned: !share.showAbandoned })}
            >
              {t("showClosed")}
            </button>
            <button type="button" className="chip chip-more" aria-expanded={filtersOpen || share.view === "filters"} onClick={openFilters}>
              {activeFilterCount > 0 ? t("filterCountShort", { n: activeFilterCount }) : t("allFilters")}
            </button>
          </div>
        </div>
        <div className="list-wrap">
          <ResortList />
        </div>
        <div className="filters-pane">
          <Filters onClose={closeFilters} />
        </div>
        {share.resort ? <ResortDetail /> : null}
      </aside>
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
