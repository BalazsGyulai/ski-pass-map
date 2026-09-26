"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { cities, passes, resorts } from "@/lib/data";
import { fold } from "@/lib/filter";
import { regionLabel, type MessageKey } from "@/lib/i18n";
import type { AgeCategory } from "@/lib/age";
import { AGE_CATEGORIES } from "@/lib/age";
import { IconClose } from "./icons";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";

const ageKey: Record<AgeCategory, MessageKey> = {
  adult: "ageAdult",
  "young-adult": "ageYoung",
  youth: "ageYouth",
  child: "ageChild",
};

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { share, updateShare, resetFilters, selectResort, t, lang, locate, locating, geoError, home, birthYear, setBirthYear } = useApp();
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
    const passHits = passes.filter((pass) => fold(pass.name).includes(query));
    const regionHits = regions.filter((region) => fold(regionLabel(lang, region)).includes(query) || fold(region).includes(query));
    return { resortHits, passHits, regionHits };
  }, [query, regions, lang]);

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
        <div className="drawer-head">
          <h2>{t("filters")}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("closeFilters")}>
            <IconClose />
          </button>
        </div>
        <div className="filter-body">
          <label className="field">
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
                    <span>{regionLabel(lang, resort.region)}</span>
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
                    {pass.name}
                  </button>
                ))}
              </Group>
              <Group title={t("groupRegions")}>
                {groups.regionHits.map((region) => (
                  <button key={region} type="button" onClick={() => updateShare({ regions: [region], q: "" })}>
                    {regionLabel(lang, region)}
                  </button>
                ))}
              </Group>
            </div>
          ) : null}

          <fieldset>
            <legend>{t("passFilter")}</legend>
            {passes.map((pass) => {
              const on = share.passes.includes(pass.id);
              return (
                <label key={pass.id} className="check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      updateShare({
                        passes: on ? share.passes.filter((id) => id !== pass.id) : [...share.passes, pass.id],
                        noPass: false,
                      });
                    }}
                  />
                  <span className="swatch" style={{ background: pass.color }} />
                  <span>
                    {pass.name} <span className="hint">{t("resortCount", { n: passCounts.get(pass.id) ?? 0 })}</span>
                  </span>
                </label>
              );
            })}
            <label className="check">
              <input type="checkbox" checked={share.noPass} onChange={() => updateShare({ noPass: !share.noPass, passes: [] })} />
              <span className="swatch swatch-grey" />
              <span>{t("noPass")}</span>
            </label>
            <label className="field">
              <span>{t("matchMode")}</span>
              <select value={share.passMatch} onChange={(event) => updateShare({ passMatch: event.target.value === "all" ? "all" : "any" })}>
                <option value="any">{t("passMatchAny")}</option>
                <option value="all">{t("passMatchAll")}</option>
              </select>
            </label>
          </fieldset>

          <fieldset>
            <legend>{t("pricesFor")}</legend>
            <div className="seg" role="radiogroup" aria-label={t("ageGroupLabel")}>
              {AGE_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  role="radio"
                  aria-checked={share.age === category}
                  className={share.age === category ? "is-on" : ""}
                  onClick={() => updateShare({ age: category })}
                >
                  {t(ageKey[category])}
                </button>
              ))}
            </div>
            <label className="field">
              <span>{t("birthYearOptional")}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1940}
                max={2026}
                value={birthYear ?? ""}
                onChange={(event) => setBirthYear(event.target.value === "" ? null : Number(event.target.value))}
              />
            </label>
            <p className="hint">{t("birthYearExact")}</p>
          </fieldset>

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
                    <span>{regionLabel(lang, region)}</span>
                  </label>
                );
              })}
            </fieldset>
            <label className="field">
              <span>{t("homeBase")}</span>
              <select
                value={share.home}
                onChange={(event) => {
                  const next = event.target.value;
                  updateShare(next === "geo" ? { home: next } : { home: next, geoLat: null, geoLon: null });
                }}
              >
                <option value="">{t("homeNone")}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
                <option value="geo">{t("homeGeo")}</option>
              </select>
            </label>
            <button type="button" className="ghost wide" onClick={locate} disabled={locating}>
              {locating ? t("locating") : t("useMyLocation")}
            </button>
            {geoError === "denied" ? <p className="hint warn">{t("geoDenied")}</p> : null}
            {geoError === "unsupported" ? <p className="hint warn">{t("geoUnsupported")}</p> : null}
            {share.home === "geo" && !home ? <p className="hint">{t("useMyLocation")}</p> : null}
            <p className="hint">{t("straightLine")}</p>
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
