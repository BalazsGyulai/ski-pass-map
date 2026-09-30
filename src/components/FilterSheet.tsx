"use client";

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { passes, resorts } from "@/lib/data";
import { fold } from "@/lib/filter";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { matchReferenceCities } from "@/lib/places";
import { regionLabel } from "@/lib/i18n";
import { safeColor } from "@/lib/resort-layers";
import { IconClose } from "./icons";
import { PlacePicker } from "./PlacePicker";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";
import { formatEur } from "@/lib/format";

/** The pass-price slider. The top end means any price. */
const MIN_PASS_PRICE = 300;
const MAX_PASS_PRICE = 1300;

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { share, updateShare, resetFilters, selectResort, saveCity, home, t, messages, lang } = useApp();
  const { filtered } = useResortLists();
  const searchRef = useRef<HTMLInputElement>(null);
  const query = fold(share.q.trim());

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const regions = useMemo(() => [...new Set(resorts.map((resort) => resort.region))].sort((a, b) => a.localeCompare(b, "de")), []);
  const passCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const resort of resorts) {
      if (resort.abandoned) continue;
      for (const id of resort.passes) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, []);

  const groups = useMemo(() => {
    if (!query) return null;
    const resortHits = resorts
      .filter((resort) => fold(`${resort.name} ${resort.region}`).includes(query))
      .slice(0, 8);
    const passHits = passes.filter((pass) => fold(`${pass.name} ${passShortName(pass)}`).includes(query));
    const regionHits = regions.filter((region) => fold(regionLabel(messages, region)).includes(query) || fold(region).includes(query));
    return { resortHits, passHits, regionHits };
  }, [query, regions, messages]);

  if (!open) return null;

  return (
    <div className="scrim scrim-filter">
      <button type="button" className="scrim-hit" aria-label={t("closeFilters")} onClick={onClose} />
      <form
        className="filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={t("filters")}
        onSubmit={(event) => {
          event.preventDefault();
          onClose();
        }}
      >
        <div className="filter-top">
          <label className="field filter-search">
            <span className="sr-only">{t("searchLabel")}</span>
            <input
              ref={searchRef}
              id="resort-search"
              type="search"
              value={share.q}
              placeholder={t("searchPillLabel")}
              onChange={(event) => updateShare({ q: event.target.value })}
            />
          </label>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("closeFilters")}>
            <IconClose />
          </button>
        </div>
        <h2 className="filter-title">{t("filters")}</h2>
        <div className="filter-body">
          {groups ? (
            <div className="typeahead">
              <Group title={t("groupResorts")}>
                {groups.resortHits.map((resort) => (
                  <button
                    key={resort.id}
                    type="button"
                    onClick={() => {
                      selectResort(resort.id);
                      onClose();
                    }}
                  >
                    <strong>{resort.name}</strong>
                    <span>{regionLabel(messages, resort.region)}</span>
                  </button>
                ))}
              </Group>
              <Group title={t("groupPasses")}>
                {groups.passHits.map((pass) => (
                  <button
                    key={pass.id}
                    type="button"
                    onClick={() => {
                      const on = share.passes.includes(pass.id);
                      updateShare({ passes: on ? share.passes.filter((id) => id !== pass.id) : [...share.passes, pass.id], noPass: false, q: "" });
                    }}
                  >
                    <span className="swatch" style={{ background: pass.color }} />
                    <span>
                      {passShortName(pass)}
                      {passHasShortName(pass) ? <span className="pass-official"> {pass.name}</span> : null}
                    </span>
                  </button>
                ))}
              </Group>
              <Group title={t("referencePlace")}>
                {matchReferenceCities(share.q).map((city) => (
                  <button
                    key={city.id}
                    type="button"
                    onClick={() => {
                      saveCity(city);
                      updateShare({ q: "" });
                    }}
                  >
                    {t("savePlace", { name: city.name })}
                  </button>
                ))}
              </Group>
              <Group title={t("groupRegions")}>
                {groups.regionHits.map((region) => (
                  <button key={region} type="button" onClick={() => updateShare({ regions: [region], q: "" })}>
                    {regionLabel(messages, region)}
                  </button>
                ))}
              </Group>
            </div>
          ) : null}

          <section className="pass-picks" aria-label={t("passFilter")}>
            <h3>{t("passFilter")}</h3>
            <div className="pass-pick-list">
              {passes.map((pass) => {
                const on = share.passes.includes(pass.id);
                const count = passCounts.get(pass.id) ?? 0;
                return (
                  <PassPick
                    key={pass.id}
                    on={on}
                    color={safeColor(pass.color)}
                    name={passShortName(pass)}
                    official={passHasShortName(pass) ? pass.name : null}
                    count={t("resortCount", { n: count })}
                    onToggle={() =>
                      updateShare({
                        passes: on ? share.passes.filter((id) => id !== pass.id) : [...share.passes, pass.id],
                        noPass: false,
                      })
                    }
                  />
                );
              })}
              <PassPick on={share.noPass} name={t("noPass")} onToggle={() => updateShare({ noPass: !share.noPass, passes: [] })} />
            </div>
            <label className="field">
              <span>{t("matchMode")}</span>
              <select value={share.passMatch} onChange={(event) => updateShare({ passMatch: event.target.value === "all" ? "all" : "any" })}>
                <option value="any">{t("passMatchAny")}</option>
                <option value="all">{t("passMatchAll")}</option>
              </select>
            </label>
          </section>

          <fieldset>
            <legend>{t("passPrice")}</legend>
            <label className="days-slider">
              <span className="num">{share.maxPassPrice == null ? t("anyPrice") : t("upToPrice", { price: formatEur(lang, share.maxPassPrice) })}</span>
              <input
                type="range"
                min={MIN_PASS_PRICE}
                max={MAX_PASS_PRICE}
                step={50}
                value={share.maxPassPrice ?? MAX_PASS_PRICE}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  updateShare({ maxPassPrice: value >= MAX_PASS_PRICE ? null : value });
                }}
              />
            </label>
            <p className="hint">{t("birthYearExact")}</p>
          </fieldset>

          <PlacePicker />

          <label className="check">
            <input type="checkbox" checked={share.night} onChange={() => updateShare({ night: !share.night })} />
            <span>{t("nightSkiing")}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={share.park} onChange={() => updateShare({ park: !share.park })} />
            <span>{t("snowpark")}</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={share.showAbandoned} onChange={() => updateShare({ showAbandoned: !share.showAbandoned })} />
            <span>{t("showClosed")}</span>
          </label>
          <p className="hint">{t("showClosedHint")}</p>

          <details className="more-filters">
            <summary>{t("moreFilters")}</summary>
            <fieldset>
              <legend>{t("region")}</legend>
              {regions.map((region) => {
                const on = share.regions.includes(region);
                return (
                  <label key={region} className="check">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        updateShare({ regions: on ? share.regions.filter((item) => item !== region) : [...share.regions, region] })
                      }
                    />
                    <span>{regionLabel(messages, region)}</span>
                  </label>
                );
              })}
            </fieldset>
            {home ? (
              <label className="field">
                <span>{t("maxDistance")}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={share.maxKm ?? ""}
                  onChange={(event) => updateShare({ maxKm: event.target.value === "" ? null : Number(event.target.value) })}
                />
              </label>
            ) : null}
            <label className="field">
              <span>{t("minElev")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={share.minElev ?? ""}
                onChange={(event) => updateShare({ minElev: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </label>
            <label className="field">
              <span>{t("minSlope")}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={share.minSlope ?? ""}
                onChange={(event) => updateShare({ minSlope: event.target.value === "" ? null : Number(event.target.value) })}
              />
            </label>
            <label className="check">
              <input type="checkbox" checked={share.transit} onChange={() => updateShare({ transit: !share.transit })} />
              <span>{t("klima")}</span>
            </label>
            <p className="hint">{t("klimaHint")}</p>
            <label className="check">
              <input type="checkbox" checked={share.favouritesOnly} onChange={() => updateShare({ favouritesOnly: !share.favouritesOnly })} />
              <span>{t("favouritesOnly")}</span>
            </label>
            <p className="hint">{t("unknownHidden")}</p>
          </details>
        </div>
        <div className="filter-footer">
          <button type="button" className="ghost" onClick={resetFilters}>
            {t("clearAll")}
          </button>
          <button type="submit" className="primary">
            {t("showResorts", { n: filtered.length })}
          </button>
        </div>
      </form>
    </div>
  );
}

function PassPick({
  on,
  color,
  name,
  official,
  count,
  onToggle,
}: {
  on: boolean;
  color?: string;
  name: string;
  official?: string | null;
  count?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={on ? "pass-pick is-on" : "pass-pick"}
      aria-pressed={on}
      style={color ? ({ "--pass": color } as CSSProperties) : undefined}
      onClick={onToggle}
    >
      <span className="pass-pick-bar" aria-hidden="true" />
      <span className="pass-pick-copy">
        <strong>{name}</strong>
        {official ? <span className="pass-official">{official}</span> : null}
      </span>
      {count ? <span className="pass-pick-count">{count}</span> : null}
      <span className="pass-pick-tick" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path d="m5 13 4 4 10-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const list = Array.isArray(children) ? children : [children];
  if (list.every((child) => child == null || child === false)) return null;
  return (
    <section>
      <h3>{title}</h3>
      <div className="type-list">{children}</div>
    </section>
  );
}
