"use client";

import { useEffect, useRef, useState } from "react";
import { generated, passById, resortById } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { finiteOrBlank, formatBreakEven, formatDate, formatEur, formatKm } from "@/lib/format";
import { countryLabel, priceReasonText, regionLabel, type MessageKey } from "@/lib/i18n";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { adultBracket, dayTicketIsEstimate, nextPriceChange, pricesOnDate, resolveForViewer } from "@/lib/pricing";
import type { Pass } from "@/lib/schema";
import { snapFromKey, type SheetSnap } from "@/lib/sheet";
import type { Resort } from "@/lib/schema";
import { IconClose } from "./icons";
import { PlacePicker } from "./PlacePicker";
import { SourceLine } from "./SourceLine";
import { startSheetDrag } from "./sheet-drag";
import { useApp } from "./AppState";
import { formatAttributionLine } from "@/lib/portal/attribution";
import { mergeResortWithOverrides } from "@/lib/portal/overrides";
import { useRuntimeOverrides } from "@/lib/runtime-overrides-client";
import { useResortLists } from "./useResorts";

const pages = ["prices", "pistes", "snow", "travel", "links"] as const;
const pageKey: Record<(typeof pages)[number], MessageKey> = {
  prices: "tabPrices",
  pistes: "tabPistes",
  snow: "tabSnow",
  travel: "tabTravel",
  links: "tabLinks",
};

export function ResortCard({ snap, setSnap }: { snap: SheetSnap; setSnap: (snap: SheetSnap) => void }) {
  const app = useApp();
  const { share, selectResort, t, lang, home, resortDays, setResortDaysCount, messages } = app;
  const overrides = useRuntimeOverrides();
  const baseResort = share.resort ? resortById.get(share.resort) : undefined;
  const resort = baseResort ? mergeResortWithOverrides(baseResort, baseResort.id, overrides) : undefined;
  const { sortedAll, filtered } = useResortLists();
  const sheetRef = useRef<HTMLElement>(null);
  const pagerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
    pagerRef.current?.scrollTo({ left: 0 });
    titleRef.current?.focus();
  }, [resort?.id]);

  if (!resort) return null;
  const index = sortedAll.findIndex((item) => item.id === resort.id);
  const previous = index > 0 ? sortedAll[index - 1] : null;
  const next = index >= 0 && index < sortedAll.length - 1 ? sortedAll[index + 1] : null;
  const days = resortDays[resort.id] ?? 0;
  const distance = home ? distanceKm(home, resort) : null;
  const visible = filtered.some((item) => item.id === resort.id);

  function go(nextPage: number) {
    const clamped = Math.max(0, Math.min(pages.length - 1, nextPage));
    setPage(clamped);
    const pager = pagerRef.current;
    const child = pager?.children[clamped] as HTMLElement | undefined;
    if (!pager || !child) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pager.scrollTo({ left: child.offsetLeft, behavior: reduced ? "auto" : "smooth" });
  }

  function onTabsKey(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(page + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(page - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      go(0);
    } else if (event.key === "End") {
      event.preventDefault();
      go(pages.length - 1);
    }
  }

  function onHandleKey(event: React.KeyboardEvent) {
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    const nextSnap = snapFromKey(snap, event.key);
    if (nextSnap == null || nextSnap === snap) return;
    event.preventDefault();
    if (nextSnap === "close") selectResort(null);
    else setSnap(nextSnap);
  }

  const stats = [
    finiteOrBlank(resort.top_elevation_m) != null ? t("keyStatElev", { n: resort.top_elevation_m ?? 0 }) : null,
    finiteOrBlank(resort.slope_km) != null ? t("keyStatKm", { n: resort.slope_km ?? 0 }) : null,
    finiteOrBlank(resort.lifts) != null ? t("keyStatLifts", { n: resort.lifts ?? 0 }) : null,
  ].filter(Boolean);

  return (
    <article ref={sheetRef} className={`resort-card snap-${snap}`} aria-labelledby="resort-title">
      <div
        className="sheet-grab"
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t("resortHandle")}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={snap === "peek" ? 0 : snap === "half" ? 1 : 2}
        aria-valuetext={snap}
        onPointerDown={(event) => startSheetDrag(event, { snap, apply: setSnap, close: () => selectResort(null), sheet: sheetRef.current, mode: "resort" })}
        onKeyDown={onHandleKey}
      >
        <span className="grab-bar" />
      </div>
      <header
        className="sheet-head resort-head"
        onPointerDown={(event) => startSheetDrag(event, { snap, apply: setSnap, close: () => selectResort(null), sheet: sheetRef.current, mode: "resort" })}
      >
        <p className="eyebrow">
          {regionLabel(messages, resort.region)} · {countryLabel(messages, resort.country)}
          {distance != null && formatKm(lang, distance) ? ` · ${t("kmAway", { n: formatKm(lang, distance) })}` : ""}
        </p>
        <h2 id="resort-title" ref={titleRef} tabIndex={-1}>
          {resort.name}
        </h2>
        <p className="meta">
          {resort.abandoned ? <span className="badge warn">{t("statusClosed")}</span> : null}
          {!resort.abandoned && resort.season_dates ? <span className="badge badge-open">{t("openSeason", { dates: resort.season_dates })}</span> : null}
          {resort.needs_recheck ? <span className="badge warn">{t("needsRecheck")}</span> : null}
          {stats.length > 0 ? <span>{stats.join(" · ")}</span> : null}
        </p>
        <button type="button" className="icon-btn close-card" onClick={() => selectResort(null)} aria-label={t("closeNamed", { name: resort.name })}>
          <IconClose />
        </button>
      </header>
      {!visible ? <p className="hint warn sheet-note">{t("hiddenByFilters")}</p> : null}
      {resort.portalAttribution ? (
        <p className="portal-attribution hint sheet-note" data-testid="portal-attribution">
          {formatAttributionLine(resort.portalAttribution, lang === "de" ? "de" : "en")}
        </p>
      ) : null}
      {resort.portalPromo ? (
        <aside className="portal-promo sheet-note" data-testid="portal-promo" aria-label="Resort promotion">
          <p className="badge">
            {lang === "de" ? `Anzeige · vom ${resort.portalPromo.resortName}` : `Ad · From ${resort.portalPromo.resortName}`}
          </p>
          <p>{resort.portalPromo.text}</p>
          {resort.portalPromo.linkUrl ? (
            <a href={resort.portalPromo.linkUrl} rel="noopener noreferrer">
              {resort.portalPromo.linkUrl}
            </a>
          ) : null}
        </aside>
      ) : null}
      <div className="card-tabs" role="tablist" aria-label={t("cardTabs")} onKeyDown={onTabsKey}>
        {pages.map((id, tabIndex) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={page === tabIndex}
            aria-controls={`panel-${id}`}
            tabIndex={page === tabIndex ? 0 : -1}
            className={page === tabIndex ? "is-on" : ""}
            onClick={() => go(tabIndex)}
          >
            {t(pageKey[id])}
          </button>
        ))}
      </div>
      <div
        className="card-pager"
        ref={pagerRef}
        onScroll={(event) => {
          const pager = event.currentTarget;
          const width = (pager.children[0] as HTMLElement | undefined)?.offsetWidth ?? pager.clientWidth;
          if (width <= 0) return;
          const nextPage = Math.round(pager.scrollLeft / width);
          if (nextPage !== page) setPage(Math.max(0, Math.min(pages.length - 1, nextPage)));
        }}
      >
        <section className="card-page" role="tabpanel" id="panel-prices" aria-labelledby="tab-prices">
          <PricesPage resort={resort} />
        </section>
        <section className="card-page" role="tabpanel" id="panel-pistes" aria-labelledby="tab-pistes">
          <PistesPage resort={resort} />
        </section>
        <section className="card-page" role="tabpanel" id="panel-snow" aria-labelledby="tab-snow">
          <SnowPage resort={resort} />
        </section>
        <section className="card-page" role="tabpanel" id="panel-travel" aria-labelledby="tab-travel">
          <TravelPage resort={resort} />
        </section>
        <section className="card-page" role="tabpanel" id="panel-links" aria-labelledby="tab-links">
          <LinksPage resort={resort} />
        </section>
      </div>
      <footer className="action-bar">
        {days > 0 ? (
          <div className="stepper">
            <button type="button" aria-label={t("decreaseDays")} onClick={() => setResortDaysCount(resort.id, days - 1)}>
              −
            </button>
            <span className="num">{t("plannedBadge", { n: days })}</span>
            <button type="button" aria-label={t("increaseDays")} onClick={() => setResortDaysCount(resort.id, days + 1)}>
              +
            </button>
          </div>
        ) : (
          <button type="button" className="primary" onClick={() => setResortDaysCount(resort.id, 1)}>
            {t("addToPlan")}
          </button>
        )}
        <div className="resort-nav">
          <button type="button" className="icon-btn" disabled={!previous} aria-label={previous ? t("prevResort", { name: previous.name }) : t("noPrevResort")} onClick={() => previous && selectResort(previous.id)}>
            ‹
          </button>
          <button type="button" className="icon-btn" disabled={!next} aria-label={next ? t("nextResort", { name: next.name }) : t("noNextResort")} onClick={() => next && selectResort(next.id)}>
            ›
          </button>
        </div>
      </footer>
    </article>
  );
}

function PricesPage({ resort }: { resort: Resort }) {
  const { t, lang, birthYear, effectiveDate } = useApp();
  const day = finiteOrBlank(resort.day_ticket_eur);
  return (
    <div>
      <p className="hint">{birthYear == null ? t("setBirthYearHint") : t("birthYearExact")}</p>
      {resort.passes.length === 0 ? <p>{t("noPasses")}</p> : null}
      <ul className="price-list">
        {resort.passes.map((id) => {
          const pass = passById.get(id);
          if (!pass || !effectiveDate) return null;
          return <PassPrice key={id} pass={pass} day={day} />;
        })}
      </ul>
      {day != null || resort.day_ticket_dynamic ? (
        <div className="day-tile">
          <p className="hint">{t("dayTicket")}</p>
          <p className="price-lg num">
            {day != null ? formatEur(lang, day) : t("dynamicPricing")}
            {day != null && resort.day_ticket_season ? <span className="hint"> {resort.day_ticket_season}</span> : null}
          </p>
          <p>
            {day != null && dayTicketIsEstimate(resort.day_ticket_season, day) ? <span className="badge">{t("estimate")}</span> : null}
            {resort.day_ticket_dynamic ? <span className="badge warn">{t("dynamicPricing")}</span> : null}
            {resort.day_ticket_network_note ? <span className="badge">{t("networkPrice")}</span> : null}
          </p>
          {resort.day_ticket_network_note ? <p className="fact-source">{resort.day_ticket_network_note}</p> : null}
          <SourceLine source={resort.sources.dayTicket ?? resort.sources.dynamic} t={t} lang={lang} tourism={resort.via_tourism_site} />
        </div>
      ) : null}
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </div>
  );
}

function PassPrice({ pass, day }: { pass: Pass; day: number | null }) {
  const { t, lang, birthYear, effectiveDate, messages } = useApp();
  if (!effectiveDate) return null;
  const price = resolveForViewer(pass, birthYear, effectiveDate);
  const change = nextPriceChange(pass, birthYear, effectiveDate);
  const tariffs = pricesOnDate(pass, effectiveDate);
  const adult = adultBracket(pass);
  const matched = birthYear != null && price.reason === "ok" ? price.bracketId : null;
  const listed = birthYear == null ? tariffs.filter((row) => row.bracketId !== adult?.label) : tariffs;
  const breakEven = price.amountEur != null && day != null && day > 0 ? price.amountEur / day : null;
  return (
    <li className="price-row">
      <span className="price-bar" style={{ background: pass.color }} />
      <div>
        <strong className="pass-short">
          {passShortName(pass)}
          {pass.provisional ? <span className="badge">{t("provisional")}</span> : null}
        </strong>
        {passHasShortName(pass) ? <p className="pass-official">{pass.name}</p> : null}
        <p className="price-lg num">
          {price.amountEur != null ? formatEur(lang, price.amountEur) : priceReasonText(messages, lang, price.reason, price.bracketId, price.nextPeriodStart)}
        </p>
        {change ? (
          <p className="hint warn">{t("priceAfter", { price: formatEur(lang, change.toEur), date: formatDate(lang, change.date) })}</p>
        ) : null}
        {breakEven != null ? <p className="hint save">{t("paysOff", { n: formatBreakEven(breakEven) })}</p> : null}
        {listed.length > 0 ? (
          <>
            <p className="hint">{birthYear == null ? t("otherTariffs") : t("yourBracket")}</p>
            <ul className="bracket-list">
              {listed.map((row) => (
                <li key={row.bracketId} className={matched && row.bracketId === matched ? "is-match" : undefined}>
                  {row.bracketLabel}{" "}
                  {row.amountEur != null ? formatEur(lang, row.amountEur) : priceReasonText(messages, lang, row.reason, row.bracketId, row.nextPeriodStart)}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <SourceLine source={pass.source} t={t} lang={lang} />
      </div>
    </li>
  );
}

function PistesPage({ resort }: { resort: Resort }) {
  const { t, lang, share, updateShare } = useApp();
  return (
    <div>
      <div className="stat-tiles">
        <Tile label={t("slopeKm")} value={finiteOrBlank(resort.slope_km_display) != null ? `${resort.slope_km_display} km` : t("dash")} />
        <Tile label={t("lifts")} value={finiteOrBlank(resort.lifts_display) != null ? String(resort.lifts_display) : t("dash")} />
        <Tile label={t("snowpark")} value={resort.snowpark === true ? t("yes") : t("dash")} />
        <Tile label={t("nightSkiing")} value={resort.night_skiing === true ? t("yes") : t("dash")} />
      </div>
      {resort.stats_aggregate ? <p className="hint">{t("statsAggregate")}</p> : null}
      <SourceLine source={resort.sources.slopes} t={t} lang={lang} />
      <SourceLine source={resort.sources.lifts} t={t} lang={lang} />
      {resort.snowpark === true ? <SourceLine source={resort.sources.snowpark} t={t} lang={lang} /> : null}
      {resort.night_skiing === true ? <SourceLine source={resort.sources.nightSkiing} t={t} lang={lang} /> : null}
      <label className="check">
        <input type="checkbox" checked={!share.hideRuns} onChange={() => updateShare({ hideRuns: !share.hideRuns })} />
        <span>{t("showRuns")}</span>
      </label>
    </div>
  );
}

function SnowPage({ resort }: { resort: Resort }) {
  const { t, lang } = useApp();
  const top = finiteOrBlank(resort.top_elevation_m);
  const base = finiteOrBlank(resort.base_elevation_m);
  const drop = top != null && base != null ? top - base : null;
  return (
    <div>
      {top != null && base != null ? (
        <div className="profile" aria-hidden="true">
          <span>{base} m</span>
          <span className="profile-bar" />
          <span>{top} m</span>
        </div>
      ) : null}
      <div className="stat-tiles">
        {drop != null ? <Tile label={t("verticalDrop")} value={`${drop} m`} /> : null}
        {top != null && base != null ? <Tile label={t("elevation")} value={t("baseToTop", { base, top })} /> : null}
      </div>
      <SourceLine source={resort.sources.elevation} t={t} lang={lang} />
      {resort.season_dates ? (
        <p>
          <strong>{t("seasonDates")}: </strong>
          {resort.season_dates}
          <SourceLine source={resort.sources.season} t={t} lang={lang} />
        </p>
      ) : null}
      {resort.snow_report ? (
        <p>
          <a href={resort.snow_report} target="_blank" rel="noopener noreferrer">
            {t("snowReport")}
          </a>
          <SourceLine source={resort.sources.snowReport} t={t} lang={lang} />
        </p>
      ) : null}
      {resort.webcam ? (
        <p>
          <a href={resort.webcam} target="_blank" rel="noopener noreferrer">
            {t("webcams")}
          </a>
          <SourceLine source={resort.sources.webcam} t={t} lang={lang} />
        </p>
      ) : null}
      {resort.notes ? (
        <p>
          <strong>{t("notes")}: </strong>
          {resort.notes}
        </p>
      ) : null}
    </div>
  );
}

function TravelPage({ resort }: { resort: Resort }) {
  const { t, home, lang } = useApp();
  const distance = home ? distanceKm(home, resort) : null;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${resort.lat},${resort.lon}`;
  const apple = `https://maps.apple.com/?daddr=${resort.lat},${resort.lon}`;
  const km = distance != null ? formatKm(lang, distance) : "";
  return (
    <div>
      <PlacePicker />
      {home && km ? (
        <>
          <p>{t("distanceValue", { n: km })}</p>
          <p className="hint">{t("straightLine")}</p>
        </>
      ) : null}
      <div className="link-buttons">
        <a href={google} target="_blank" rel="noopener noreferrer">
          {t("directions")}
        </a>
        <a href={apple} target="_blank" rel="noopener noreferrer">
          {t("directionsApple")}
        </a>
      </div>
      {resort.public_transport ? (
        <>
          <h3>{t("transportNote")}</h3>
          <p>{resort.public_transport}</p>
        </>
      ) : null}
    </div>
  );
}

function LinksPage({ resort }: { resort: Resort }) {
  const { t, lang, favourites, toggleFavourite, copyLink, copyMessage } = useApp();
  const covered = resort.passes.map((id) => passById.get(id)).filter((pass) => pass != null);
  return (
    <div>
      <div className="link-buttons">
        {resort.website ? (
          <a href={resort.website} target="_blank" rel="noopener noreferrer">
            {t("openWebsite")}
          </a>
        ) : null}
        {resort.snow_report ? (
          <a href={resort.snow_report} target="_blank" rel="noopener noreferrer">
            {t("snowReport")}
          </a>
        ) : null}
        {resort.webcam ? (
          <a href={resort.webcam} target="_blank" rel="noopener noreferrer">
            {t("webcams")}
          </a>
        ) : null}
      </div>
      {resort.website ? <SourceLine source={resort.sources.website} t={t} lang={lang} tourism={resort.via_tourism_site} /> : null}
      {covered.length > 0 ? (
        <>
          <h3>{t("passSites")}</h3>
          <ul className="link-list">
            {covered.map((pass) => (
              <li key={pass.id}>
                <span className="swatch" style={{ background: pass.color }} />
                <a href={pass.url} target="_blank" rel="noopener noreferrer">
                  {passShortName(pass)}
                </a>
                {passHasShortName(pass) ? <span className="pass-official">{pass.name}</span> : null}
                {pass.provisional ? <span className="badge">{t("provisional")}</span> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="row-actions">
        <button type="button" className="ghost" onClick={copyLink}>
          {copyMessage ?? t("share")}
        </button>
        <button type="button" className={favourites.includes(resort.id) ? "primary" : "ghost"} aria-pressed={favourites.includes(resort.id)} onClick={() => toggleFavourite(resort.id)}>
          {favourites.includes(resort.id) ? t("favouriteRemove") : t("favouriteAdd")}
        </button>
      </div>
      <p className="fact-source">{t("dataFileDate", { date: formatDate(lang, generated) })}</p>
      <p className="fact-source">{t("osmSource")}</p>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <p className="hint">{label}</p>
      <p className="num">{value}</p>
    </div>
  );
}
