"use client";

import { cities, passes, resorts } from "@/lib/data";
import { cityNoteLabel, regionLabel } from "@/lib/i18n";
import { useApp } from "./AppState";
import type { SortKey } from "@/lib/filter";

export function Filters() {
  const { share, updateShare, resetFilters, activeFilterCount, t, lang, home, locate, locating, geoError } = useApp();
  const regions = [...new Set(resorts.map((resort) => resort.region))];
  const strictFilter = share.park || share.night || share.minElev != null || share.minSlope != null;

  function onSort(sort: SortKey) {
    const dir = sort === "elevation" || sort === "slope" ? "desc" : "asc";
    updateShare({ sort, dir });
  }

  return (
    <form className="filters-col" onSubmit={(event) => event.preventDefault()}>
      <div className="filters-head">
        <h2>{t("filters")}</h2>
        <p className="hint" aria-live="polite">
          {t("activeFilters", { n: activeFilterCount })}
        </p>
      </div>

      <label className="field">
        <span>{t("searchLabel")}</span>
        <input
          id="resort-search"
          type="search"
          value={share.q}
          placeholder={t("searchPlaceholder")}
          onChange={(event) => updateShare({ q: event.target.value })}
        />
      </label>

      <label className="field">
        <span>{t("homeBase")}</span>
        <select
          value={share.home}
          onChange={(event) => updateShare({ home: event.target.value })}
        >
          {cities.map((city) => {
            const note = cityNoteLabel(lang, city.note);
            return (
              <option key={city.id} value={city.id}>
                {city.name}
                {note ? ` · ${note}` : ""}
              </option>
            );
          })}
          <option value="geo">{t("homeGeo")}</option>
        </select>
      </label>
      <button type="button" className="ghost wide" onClick={locate} disabled={locating}>
        {locating ? t("locating") : t("useMyLocation")}
      </button>
      {share.home === "geo" && !home ? <p className="hint">{t("useMyLocation")}</p> : null}
      {geoError === "denied" ? <p className="hint warn">{t("geoDenied")}</p> : null}
      {geoError === "unsupported" ? <p className="hint warn">{t("geoUnsupported")}</p> : null}
      <p className="hint">{t("straightLine")}</p>

      <fieldset>
        <legend>{t("passFilter")}</legend>
        {passes.map((pass) => (
          <label key={pass.id} className="check">
            <input
              type="checkbox"
              checked={share.passes.includes(pass.id)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...share.passes, pass.id]
                  : share.passes.filter((id) => id !== pass.id);
                updateShare({ passes: next, noPass: event.target.checked ? false : share.noPass });
              }}
            />
            <span className="swatch" style={{ background: pass.color }} />
            <span>{pass.name}</span>
          </label>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={share.noPass}
            onChange={(event) => updateShare({ noPass: event.target.checked, passes: event.target.checked ? [] : share.passes })}
          />
          <span className="swatch swatch-grey" />
          <span>{t("noPass")}</span>
        </label>
        <div className="radios" role="radiogroup" aria-label={t("matchMode")}>
          <label className="check">
            <input
              type="radio"
              name="pass-match"
              checked={share.passMatch === "any"}
              onChange={() => updateShare({ passMatch: "any" })}
            />
            <span>{t("passMatchAny")}</span>
          </label>
          <label className="check">
            <input
              type="radio"
              name="pass-match"
              checked={share.passMatch === "all"}
              onChange={() => updateShare({ passMatch: "all" })}
            />
            <span>{t("passMatchAll")}</span>
          </label>
        </div>
        <p className="hint">{t("passAnyHint")}</p>
      </fieldset>

      <fieldset>
        <legend>{t("region")}</legend>
        {regions.map((region) => (
          <label key={region} className="check">
            <input
              type="checkbox"
              checked={share.regions.includes(region)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...share.regions, region]
                  : share.regions.filter((item) => item !== region);
                updateShare({ regions: next });
              }}
            />
            <span>{regionLabel(lang, region)}</span>
          </label>
        ))}
      </fieldset>

      <label className="check">
        <input type="checkbox" checked={share.klima} onChange={(event) => updateShare({ klima: event.target.checked })} />
        <span>{t("klima")}</span>
      </label>
      <p className="hint">{t("klimaHint")}</p>
      <label className="check">
        <input type="checkbox" checked={share.park} onChange={(event) => updateShare({ park: event.target.checked })} />
        <span>{t("snowpark")}</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={share.night} onChange={(event) => updateShare({ night: event.target.checked })} />
        <span>{t("nightSkiing")}</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={share.favouritesOnly}
          onChange={(event) => updateShare({ favouritesOnly: event.target.checked })}
        />
        <span>{t("favouritesOnly")}</span>
      </label>

      <label className="field">
        <span>{t("minElev")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={50}
          value={share.minElev ?? ""}
          onChange={(event) => updateShare({ minElev: numberOrNull(event.target.value) })}
        />
      </label>
      <label className="field">
        <span>{t("minSlope")}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={1}
          value={share.minSlope ?? ""}
          onChange={(event) => updateShare({ minSlope: numberOrNull(event.target.value) })}
        />
      </label>
      <label className="field">
        <span>{t("maxDistance")}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={5}
          value={share.maxKm ?? ""}
          onChange={(event) => updateShare({ maxKm: numberOrNull(event.target.value) })}
        />
      </label>
      <p className="hint">{t("maxDistanceHelp")}</p>
      {strictFilter ? <p className="hint warn">{t("unknownHidden")}</p> : null}

      <div className="sort-row">
        <label className="field">
          <span>{t("sort")}</span>
          <select value={share.sort} onChange={(event) => onSort(event.target.value as SortKey)}>
            <option value="distance">{t("sortDistance")}</option>
            <option value="day">{t("sortDay")}</option>
            <option value="elevation">{t("sortElevation")}</option>
            <option value="slope">{t("sortSlope")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        </label>
        <label className="field">
          <span>{t("sortDir")}</span>
          <select value={share.dir} onChange={(event) => updateShare({ dir: event.target.value === "desc" ? "desc" : "asc" })}>
            <option value="asc">{t("ascending")}</option>
            <option value="desc">{t("descending")}</option>
          </select>
        </label>
      </div>

      <div className="legend">
        <p>{t("legendPie")}</p>
        <p>{t("legendGrey")}</p>
        <p>{t("legendKlima")}</p>
        <p>{t("legendCluster")}</p>
      </div>

      <div className="filter-footer">
        <button type="button" className="primary wide" onClick={resetFilters}>
          {t("reset")}
        </button>
      </div>
    </form>
  );
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}
