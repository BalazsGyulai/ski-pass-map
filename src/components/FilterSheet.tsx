"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent, type UIEvent } from "react";
import { passes, resorts } from "@/lib/data";
import { fold, measureFromField, PASS_PRICE_MAX, PASS_PRICE_MIN, PASS_PRICE_STEP, snapPassPrice } from "@/lib/filter";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { matchReferenceCities } from "@/lib/places";
import { regionLabel } from "@/lib/i18n";
import { safeColor } from "@/lib/resort-layers";
import { IconClose } from "./icons";
import { PlacePicker } from "./PlacePicker";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";

/** The region list opens under the summary, often below the fold. Keep the More row on screen. */
function revealMoreFilters(event: SyntheticEvent<HTMLDetailsElement>) {
  const details = event.currentTarget;
  if (!details.open) return;
  const body = details.closest(".filter-body");
  if (!(body instanceof HTMLElement)) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    const summary = details.querySelector("summary");
    if (!(summary instanceof HTMLElement)) return;
    const delta = summary.getBoundingClientRect().top - (body.getBoundingClientRect().top + 8);
    if (delta > 12) body.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
    syncFilterFade(body);
  });
}

/** Fade the scroll edges only when content is actually hidden there. */
function syncFilterFade(body: HTMLElement) {
  const host = body.parentElement;
  if (!host) return;
  host.classList.toggle("fade-top", body.scrollTop > 8);
  host.classList.toggle("fade-bottom", body.scrollHeight - body.scrollTop - body.clientHeight > 8);
}

export function FilterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { share, updateShare, resetFilters, selectResort, saveCity, home, t, messages } = useApp();
  const { filtered } = useResortLists();
  const searchRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [minDraft, setMinDraft] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<string | null>(null);
  const [elevDraft, setElevDraft] = useState<string | null>(null);
  const [slopeDraft, setSlopeDraft] = useState<string | null>(null);
  const [kmDraft, setKmDraft] = useState<string | null>(null);
  const [rangeOnTop, setRangeOnTop] = useState<"min" | "max">("max");
  const query = fold(share.q.trim());
  const minValue = share.minPassPrice ?? PASS_PRICE_MIN;
  const maxValue = share.maxPassPrice ?? PASS_PRICE_MAX;
  const minPercent = ((minValue - PASS_PRICE_MIN) / (PASS_PRICE_MAX - PASS_PRICE_MIN)) * 100;
  const maxPercent = ((maxValue - PASS_PRICE_MIN) / (PASS_PRICE_MAX - PASS_PRICE_MIN)) * 100;

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    syncFilterFade(bodyRef.current);
  }, [open, share]);

  function onFilterScroll(event: UIEvent<HTMLDivElement>) {
    syncFilterFade(event.currentTarget);
  }

  function commitPrice(raw: string, bound: "min" | "max", live: boolean) {
    if (raw.trim() === "") {
      if (bound === "min") setMinDraft(null);
      else setMaxDraft(null);
      updateShare(bound === "min" ? { minPassPrice: null } : { maxPassPrice: null });
      return;
    }
    const value = Number(raw);
    // A short number such as "8" is still being typed. Wait until it reaches the scale, or the field is left.
    if (!Number.isFinite(value) || (live && value < PASS_PRICE_MIN)) {
      if (bound === "min") setMinDraft(raw);
      else setMaxDraft(raw);
      return;
    }
    if (bound === "min") setMinDraft(null);
    else setMaxDraft(null);
    const next = snapPassPrice(value, bound === "min" ? maxValue : minValue, bound);
    updateShare(bound === "min" ? { minPassPrice: next } : { maxPassPrice: next });
  }

  function editMeasure(raw: string, integer: boolean, setDraft: (value: string | null) => void, apply: (value: number | null) => void) {
    const next = measureFromField(raw, integer);
    if (next === undefined) {
      if (!integer && /^\d+\.$/.test(raw)) setDraft(raw);
      return;
    }
    setDraft(null);
    apply(next);
  }

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
        <div className="filter-scroll">
        <div className="filter-body" ref={bodyRef} onScroll={onFilterScroll}>
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
            <fieldset className="match-mode">
              <legend>{t("matchMode")}</legend>
              <div className="match-options">
                <label className="match-option">
                  <input
                    type="radio"
                    name="pass-match"
                    checked={share.passMatch !== "all"}
                    onChange={() => updateShare({ passMatch: "any" })}
                  />
                  <span className="match-option-copy">
                    <span className="match-option-title">{t("passMatchAny")}</span>
                    <span className="match-option-hint">{t("passMatchAnyHint")}</span>
                  </span>
                </label>
                <label className="match-option">
                  <input
                    type="radio"
                    name="pass-match"
                    checked={share.passMatch === "all"}
                    onChange={() => updateShare({ passMatch: "all" })}
                  />
                  <span className="match-option-copy">
                    <span className="match-option-title">{t("passMatchAll")}</span>
                    <span className="match-option-hint">{t("passMatchAllHint")}</span>
                  </span>
                </label>
              </div>
            </fieldset>
          </section>

          <fieldset className="price-band">
            <legend>{t("passPrice")}</legend>
            <div className="price-fields">
              <label className="field">
                <span>{t("priceMin")}</span>
                <span className="unit-field">
                  <input
                    className="num"
                    inputMode="numeric"
                    min={PASS_PRICE_MIN}
                    max={maxValue}
                    step={PASS_PRICE_STEP}
                    value={minDraft ?? String(minValue)}
                    onChange={(event) => commitPrice(event.target.value, "min", true)}
                    onBlur={(event) => commitPrice(event.target.value, "min", false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <span className="unit">€</span>
                </span>
              </label>
              <label className="field">
                <span>{t("priceMax")}</span>
                <span className="unit-field">
                  <input
                    className="num"
                    inputMode="numeric"
                    min={minValue}
                    max={PASS_PRICE_MAX}
                    step={PASS_PRICE_STEP}
                    value={maxDraft ?? String(maxValue)}
                    onChange={(event) => commitPrice(event.target.value, "max", true)}
                    onBlur={(event) => commitPrice(event.target.value, "max", false)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                  />
                  <span className="unit">€</span>
                </span>
              </label>
            </div>
            <div
              className="range-pair"
              style={{ "--lo": `${minPercent}%`, "--hi": `${maxPercent}%` } as CSSProperties}
            >
              <input
                type="range"
                aria-label={t("priceMin")}
                min={PASS_PRICE_MIN}
                max={PASS_PRICE_MAX}
                step={PASS_PRICE_STEP}
                value={minValue}
                style={{ zIndex: rangeOnTop === "min" ? 2 : 1 }}
                onPointerDown={() => setRangeOnTop("min")}
                onChange={(event) => {
                  setMinDraft(null);
                  const next = snapPassPrice(Number(event.target.value), maxValue, "min");
                  updateShare({ minPassPrice: next });
                }}
              />
              <input
                type="range"
                aria-label={t("priceMax")}
                min={PASS_PRICE_MIN}
                max={PASS_PRICE_MAX}
                step={PASS_PRICE_STEP}
                value={maxValue}
                style={{ zIndex: rangeOnTop === "max" ? 2 : 1 }}
                onPointerDown={() => setRangeOnTop("max")}
                onChange={(event) => {
                  setMaxDraft(null);
                  const next = snapPassPrice(Number(event.target.value), minValue, "max");
                  updateShare({ maxPassPrice: next });
                }}
              />
            </div>
            <p className="hint">{t("birthYearExact")}</p>
          </fieldset>

          <PlacePicker />

          <section className="filter-features">
            <h3>{t("filterFeatures")}</h3>
            <div className="filter-checks">
              <label className="check">
                <input type="checkbox" checked={share.night} onChange={() => updateShare({ night: !share.night })} />
                <span className="check-copy">
                  <span>{t("nightSkiing")}</span>
                  <span className="hint">{t("nightSkiingHint")}</span>
                </span>
              </label>
              <label className="check">
                <input type="checkbox" checked={share.park} onChange={() => updateShare({ park: !share.park })} />
                <span className="check-copy">
                  <span>{t("snowpark")}</span>
                  <span className="hint">{t("snowparkHint")}</span>
                </span>
              </label>
              <label className="check">
                <input type="checkbox" checked={share.transit} onChange={() => updateShare({ transit: !share.transit })} />
                <span className="check-copy">
                  <span>{t("klima")}</span>
                  <span className="hint">{t("klimaHint")}</span>
                </span>
              </label>
              <label className="check">
                <input type="checkbox" checked={share.favouritesOnly} onChange={() => updateShare({ favouritesOnly: !share.favouritesOnly })} />
                <span className="check-copy">
                  <span>{t("favouritesOnly")}</span>
                  <span className="hint">{t("favouritesHint")}</span>
                </span>
              </label>
              <label className="check">
                <input type="checkbox" checked={share.showAbandoned} onChange={() => updateShare({ showAbandoned: !share.showAbandoned })} />
                <span className="check-copy">
                  <span>{t("showClosed")}</span>
                  <span className="hint">{t("showClosedHint")}</span>
                </span>
              </label>
            </div>
            <p className="hint">{t("unknownHidden")}</p>
          </section>

          <details className="more-filters" onToggle={revealMoreFilters}>
            <summary>
              <span className="more-filters-label">
                <span className="more-filters-copy">
                  <span className="more-filters-title">{t("moreFilters")}</span>
                  <span className="more-filters-hint">{t("moreFiltersHint")}</span>
                </span>
                <span className="more-filters-chevron" aria-hidden="true" />
              </span>
            </summary>
            <div className="more-filters-body">
              <fieldset className="region-picks">
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
                  <span className="unit-field">
                    <input
                      className="num"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder={t("anyAmount")}
                      value={kmDraft ?? (share.maxKm ?? "")}
                      onChange={(event) => editMeasure(event.target.value, false, setKmDraft, (maxKm) => updateShare({ maxKm }))}
                      onBlur={() => setKmDraft(null)}
                    />
                    <span className="unit">km</span>
                  </span>
                </label>
              ) : null}
              <label className="field">
                <span>{t("minElev")}</span>
                <span className="unit-field">
                  <input
                    className="num"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="0"
                    value={elevDraft ?? (share.minElev ?? "")}
                    onChange={(event) => editMeasure(event.target.value, true, setElevDraft, (minElev) => updateShare({ minElev }))}
                    onBlur={() => setElevDraft(null)}
                  />
                  <span className="unit">m</span>
                </span>
              </label>
              <label className="field">
                <span>{t("minSlope")}</span>
                <span className="unit-field">
                  <input
                    className="num"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    placeholder="0"
                    value={slopeDraft ?? (share.minSlope ?? "")}
                    onChange={(event) => editMeasure(event.target.value, false, setSlopeDraft, (minSlope) => updateShare({ minSlope }))}
                    onBlur={() => setSlopeDraft(null)}
                  />
                  <span className="unit">km</span>
                </span>
              </label>
            </div>
          </details>
        </div>
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
