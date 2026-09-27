"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { passes, resorts } from "@/lib/data";
import { fold } from "@/lib/filter";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { matchReferenceCities } from "@/lib/places";
import { regionLabel } from "@/lib/i18n";
import { IconClose } from "./icons";
import { PlacePicker } from "./PlacePicker";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { share, updateShare, resetFilters, selectResort, saveCity, home, t, messages } = useApp();
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
                    <strong>{passShortName(pass)}</strong>
                    {passHasShortName(pass) ? <span className="pass-official"> {pass.name}</span> : null}{" "}
                    <span className="hint">{t("resortCount", { n: passCounts.get(pass.id) ?? 0 })}</span>
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
