"use client";

import { snapFromKey, type SheetSnap } from "@/lib/sheet";
import type { SortKey } from "@/lib/filter";
import { ResortList } from "./ResortList";
import { useBottomSheet } from "./useBottomSheet";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";
import { StyledSelect } from "./ui/SettingsControls";

const sorts: SortKey[] = ["distance", "day", "elevation", "slope", "name"];
const sortKey = {
  distance: "sortDistance",
  day: "sortDay",
  elevation: "sortElevation",
  slope: "sortSlope",
  name: "sortName",
} as const;

export function ListSheet({ snap, setSnap }: { snap: SheetSnap; setSnap: (snap: SheetSnap) => void }) {
  const { share, updateShare, t, ready, resetFilters, mapApi, areaStale, searchThisArea } = useApp();
  const { sorted, filtered, relaxed } = useResortLists();
  const sheet = useBottomSheet({ kind: "list", snap, setSnap });

  function onKey(event: React.KeyboardEvent) {
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    const next = snapFromKey(snap, event.key);
    if (next == null || next === snap) return;
    event.preventDefault();
    setSnap(next === "close" ? "peek" : next);
  }

  return (
    <section ref={sheet.ref} className={`list-sheet snap-${snap}`} data-snap={snap} data-sheet-live={sheet.metrics ? "true" : undefined} style={sheet.style} aria-label={t("resorts")}>
      <div
        className="sheet-grab"
        data-sheet-handle
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t("listHandle")}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={snap === "peek" ? 0 : snap === "half" ? 1 : 2}
        aria-valuetext={snap}
        onKeyDown={onKey}
      >
        <span className="grab-bar" />
      </div>
      <header className="sheet-head" data-sheet-handle>
        <div>
          <h2>{t("inThisArea", { n: sorted.length })}</h2>
          <p className="hint">{t("sortedBy", { sort: t(sortKey[share.sort]) })}</p>
        </div>
        <StyledSelect
          ariaLabel={t("sort")}
          value={share.sort}
          options={sorts.map((sort) => ({ value: sort, label: t(sortKey[sort]) }))}
          onChange={(sort) => updateShare({ sort, dir: sort === "elevation" || sort === "slope" ? "desc" : "asc" })}
        />
      </header>
      <div className="sheet-scroll">
        {!ready ? (
          <div role="status" aria-label={t("loadingList")}>
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : null}
        {areaStale ? (
          <button type="button" className="area-inline" onClick={searchThisArea}>
            {t("searchThisArea")}
          </button>
        ) : null}
        {ready && sorted.length === 0 ? (
          <div className="empty-state">
            <p>{filtered.length === 0 ? t("noMatchTitle") : t("noneInArea")}</p>
            <div className="row-actions">
              {filtered.length === 0 ? (
                <button type="button" className="primary" onClick={resetFilters}>
                  {t("clearFilters")}
                </button>
              ) : null}
              <button type="button" className="ghost" onClick={() => mapApi.current.zoomOut()}>
                {t("zoomOut")}
              </button>
            </div>
            {filtered.length === 0 && relaxed.length > 0 ? (
              <>
                <p className="hint">{t("closestMatches")}</p>
                <ResortList items={relaxed} />
              </>
            ) : null}
          </div>
        ) : (
          <ResortList items={sorted} />
        )}
        <p className="disclaimer sheet-disclaimer">{t("globalDisclaimer")}</p>
      </div>
    </section>
  );
}
