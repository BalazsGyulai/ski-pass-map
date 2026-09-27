"use client";

import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { generated, passById, resortById, resorts as allResorts } from "@/lib/data";
import { distanceKm } from "@/lib/distance";
import { finiteOrBlank, formatBreakEven, formatDate, formatEur, formatKm, slopeKmDisplay } from "@/lib/format";
import { countryLabel, priceReasonText, regionLabel } from "@/lib/i18n";
import { passHasShortName, passShortName } from "@/lib/pass-label";
import { adultBracket, dayTicketIsEstimate, nextPriceChange, pricesOnDate, resolveForViewer, type ResolvedPrice } from "@/lib/pricing";
import type { FactRef, Pass, Resort } from "@/lib/schema";
import { snapFromKey, type SheetSnap } from "@/lib/sheet";
import { formatAttributionLine } from "@/lib/portal/attribution";
import { mergeResortWithOverrides } from "@/lib/portal/overrides";
import { useRuntimeOverrides } from "@/lib/runtime-overrides-client";
import { IconClose, IconHeart } from "./icons";
import { SourceLine } from "./SourceLine";
import { useBottomSheet } from "./useBottomSheet";
import { prefersReducedMotion } from "./useNarrow";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { useResortLists } from "./useResorts";
import { AffiliateLinksBlock } from "./AffiliateLinks";

/**
 * One scrolling card per resort: name and key facts, the passes that cover it with your price
 * (cheapest first), then facts, snow, travel and links. Sources sit next to the numbers they back.
 */
/** The page's --ease-out curve, for animations started from script. */
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

export function ResortCard({ snap, setSnap }: { snap: SheetSnap; setSnap: (snap: SheetSnap) => void }) {
  const { share, selectResort, t, lang, home, resortDays, setResortDaysCount, messages, favourites, toggleFavourite, birthYear, effectiveDate } =
    useApp();
  const href = useLocalizedPath();
  const overrides = useRuntimeOverrides();
  const baseResort = share.resort ? resortById.get(share.resort) : undefined;
  const resort = baseResort ? mergeResortWithOverrides(baseResort, baseResort.id, overrides) : undefined;
  const { sortedAll, filtered } = useResortLists();
  const closeCard = useCallback(() => selectResort(null), [selectResort]);
  const sheet = useBottomSheet({ kind: "resort", snap, setSnap, onClose: closeCard });
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sheetRef = sheet.ref;
  const shownResort = useRef<string | null>(null);

  // Stepping to another resort cross-fades the card. The first open already rises with the sheet.
  useEffect(() => {
    const id = share.resort ?? null;
    const before = shownResort.current;
    shownResort.current = id;
    if (!before || !id || before === id || prefersReducedMotion()) return;
    sheetRef.current?.querySelectorAll<HTMLElement>(".resort-head, .resort-scroll").forEach((el) => {
      if (typeof el.animate === "function") el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 240, easing: EASE_OUT });
    });
  }, [share.resort, sheetRef]);

  if (!resort) return null;
  const index = sortedAll.findIndex((item) => item.id === resort.id);
  const previous = index > 0 ? sortedAll[index - 1] : null;
  const next = index >= 0 && index < sortedAll.length - 1 ? sortedAll[index + 1] : null;
  const days = resortDays[resort.id] ?? 0;
  const distance = home ? distanceKm(home, resort) : null;
  const visible = filtered.some((item) => item.id === resort.id);
  const favourite = favourites.includes(resort.id);
  const day = finiteOrBlank(resort.day_ticket_eur);

  const quotes = effectiveDate
    ? resort.passes
        .map((id) => passById.get(id))
        .filter((pass): pass is Pass => pass != null)
        .map((pass) => ({ pass, price: resolveForViewer(pass, birthYear, effectiveDate) }))
        .sort((a, b) => (a.price.amountEur ?? Number.POSITIVE_INFINITY) - (b.price.amountEur ?? Number.POSITIVE_INFINITY))
    : [];
  const cheapest = quotes.find((quote) => quote.price.amountEur != null) ?? null;

  function onHandleKey(event: React.KeyboardEvent) {
    if (!window.matchMedia("(max-width: 899px)").matches) return;
    const nextSnap = snapFromKey(snap, event.key);
    if (nextSnap == null || nextSnap === snap) return;
    event.preventDefault();
    if (nextSnap === "close") selectResort(null);
    else setSnap(nextSnap);
  }

  const km = slopeKmDisplay(resort.slope_km_display ?? resort.slope_km);
  const stats = [
    finiteOrBlank(resort.top_elevation_m) != null ? t("keyStatElev", { n: resort.top_elevation_m ?? 0 }) : null,
    km != null ? t("keyStatKm", { n: km }) : null,
    finiteOrBlank(resort.lifts) != null ? t("keyStatLifts", { n: resort.lifts ?? 0 }) : null,
  ].filter(Boolean);

  return (
    <article ref={sheet.ref} className={`resort-card snap-${snap}`} data-snap={snap} data-sheet-live={sheet.metrics ? "true" : undefined} style={sheet.style} aria-labelledby="resort-title">
      <div
        className="sheet-grab"
        data-sheet-handle
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={t("resortHandle")}
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={snap === "peek" ? 0 : snap === "half" ? 1 : 2}
        aria-valuetext={snap}
        onKeyDown={onHandleKey}
      >
        <span className="grab-bar" />
      </div>
      <header className="sheet-head resort-head" data-sheet-handle>
        <p className="eyebrow">
          {regionLabel(messages, resort.region)} · {countryLabel(messages, resort.country)}
          {distance != null && formatKm(lang, distance) ? ` · ${t("kmAway", { n: formatKm(lang, distance) })}` : ""}
        </p>
        <h2 id="resort-title" className="resort-title" ref={titleRef} tabIndex={-1}>
          {resort.name}
        </h2>
        <p className="meta">
          {resort.abandoned ? <span className="badge warn">{t("statusClosed")}</span> : null}
          {!resort.abandoned && resort.season_dates ? <span className="badge badge-open">{t("openSeason", { dates: resort.season_dates })}</span> : null}
          {resort.needs_recheck ? <span className="badge warn">{t("needsRecheck")}</span> : null}
          {stats.length > 0 ? <span>{stats.join(" · ")}</span> : null}
        </p>
        <div className="resort-head-actions">
          <button
            type="button"
            className={favourite ? "icon-btn is-on" : "icon-btn"}
            aria-pressed={favourite}
            aria-label={favourite ? t("favouriteRemove") : t("favouriteAdd")}
            onClick={(event) => {
              // A small beat when a resort is saved; removing it stays quiet.
              const heart = event.currentTarget.querySelector("svg");
              if (!favourite && heart && typeof heart.animate === "function" && !prefersReducedMotion()) {
                heart.animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 320, easing: EASE_OUT });
              }
              toggleFavourite(resort.id);
            }}
          >
            <IconHeart />
          </button>
          <button type="button" className="icon-btn close-card" onClick={() => selectResort(null)} aria-label={t("closeNamed", { name: resort.name })}>
            <IconClose />
          </button>
        </div>
      </header>

      <div className="resort-scroll">
        {!visible ? <p className="hint warn">{t("hiddenByFilters")}</p> : null}
        {resort.portalAttribution ? (
          <p className="portal-attribution hint" data-testid="portal-attribution">
            {formatAttributionLine(resort.portalAttribution, lang === "de" ? "de" : "en")}
          </p>
        ) : null}
        {resort.portalPromo ? (
          <aside className="portal-promo" data-testid="portal-promo" aria-label="Resort promotion">
            <p className="badge">{lang === "de" ? `Anzeige · vom ${resort.portalPromo.resortName}` : `Ad · From ${resort.portalPromo.resortName}`}</p>
            <p>{resort.portalPromo.text}</p>
            {resort.portalPromo.linkUrl ? (
              <a href={resort.portalPromo.linkUrl} rel="noopener noreferrer">
                {resort.portalPromo.linkUrl}
              </a>
            ) : null}
          </aside>
        ) : null}

        <section className="resort-section" aria-labelledby="resort-passes">
          <h3 id="resort-passes">{t("passes")}</h3>
          {birthYear == null ? (
            <p className="hint">
              {t("setBirthYearHintPrefix")} <Link href={href("/settings")}>{t("navSettings")}</Link>.
            </p>
          ) : null}
          {quotes.length === 0 ? (
            <p className="hint">{t("noPasses")}</p>
          ) : (
            <ul className="pass-list">
              {quotes.map((quote) => (
                <PassRow key={quote.pass.id} pass={quote.pass} price={quote.price} day={day} cheapest={quote === cheapest && quotes.length > 1} />
              ))}
            </ul>
          )}
        </section>

        <section className="resort-section" aria-labelledby="resort-facts">
          <h3 id="resort-facts">{t("tabPistes")}</h3>
          <FactGrid resort={resort} day={day} />
        </section>

        <SnowSection resort={resort} />
        <TravelSection resort={resort} />
        <LinksSection resort={resort} />
      </div>

      <footer className="action-bar">
        {resort.website ? (
          <a className="ghost website-btn" href={resort.website} target="_blank" rel="noopener noreferrer">
            {t("openWebsite")}
            <span aria-hidden="true"> ↗</span>
          </a>
        ) : null}
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
        <div className="resort-nav desk-only">
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

function PassRow({ pass, price, day, cheapest }: { pass: Pass; price: ResolvedPrice; day: number | null; cheapest: boolean }) {
  const { t, lang, birthYear, effectiveDate, messages } = useApp();
  if (!effectiveDate) return null;
  const change = nextPriceChange(pass, birthYear, effectiveDate);
  const tariffs = pricesOnDate(pass, effectiveDate);
  const adult = adultBracket(pass);
  const matched = birthYear != null && price.reason === "ok" ? price.bracketId : null;
  const listed = birthYear == null ? tariffs.filter((row) => row.bracketId !== adult?.label) : tariffs;
  const breakEven = price.amountEur != null && day != null && day > 0 ? price.amountEur / day : null;
  const covered = allResorts.filter((resort) => resort.passes.includes(pass.id) && !resort.abandoned).length;
  return (
    <li className={cheapest ? "pass-row is-cheapest" : "pass-row"} style={{ "--pass": pass.color } as CSSProperties}>
      <div className="pass-row-top">
        <span className="pass-mark" aria-hidden="true" />
        <div className="pass-row-names">
          {cheapest ? <span className="best-label">{t("cheapestHere")}</span> : null}
          <strong className="pass-short">
            {passShortName(pass)}
            {pass.provisional ? <span className="badge">{t("provisional")}</span> : null}
          </strong>
          {passHasShortName(pass) ? <span className="pass-official">{pass.name}</span> : null}
          <span className="pass-meta">{t("resortsCovered", { n: covered })}</span>
        </div>
        <div className="pass-row-price">
          <span className="price-lg num">
            {price.amountEur != null ? formatEur(lang, price.amountEur) : priceReasonText(messages, lang, price.reason, price.bracketId, price.nextPeriodStart)}
          </span>
          {price.amountEur != null && price.periodEnd ? <span className="until-chip">{t("periodUntil", { date: formatDate(lang, price.periodEnd) })}</span> : null}
        </div>
      </div>
      {change ? <p className="hint warn">{t("priceAfter", { price: formatEur(lang, change.toEur), date: formatDate(lang, change.date) })}</p> : null}
      {breakEven != null ? <p className="hint save">{t("paysOff", { n: formatBreakEven(breakEven) })}</p> : null}
      {listed.length > 0 ? (
        <details className="tariffs" open={birthYear != null}>
          <summary>{birthYear == null ? t("otherTariffs") : t("yourBracket")}</summary>
          <ul className="bracket-list">
            {listed.map((row) => (
              <li key={row.bracketId} className={matched && row.bracketId === matched ? "is-match" : undefined}>
                <span>{row.bracketLabel}</span>
                <span className="num">
                  {row.amountEur != null ? formatEur(lang, row.amountEur) : priceReasonText(messages, lang, row.reason, row.bracketId, row.nextPeriodStart)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <SourceLine source={pass.source} t={t} lang={lang} />
    </li>
  );
}

function FactGrid({ resort, day }: { resort: Resort; day: number | null }) {
  const { t, lang, share, updateShare } = useApp();
  const top = finiteOrBlank(resort.top_elevation_m);
  const base = finiteOrBlank(resort.base_elevation_m);
  const drop = top != null && base != null ? top - base : null;
  const km = slopeKmDisplay(resort.slope_km_display ?? resort.slope_km);
  const lifts = finiteOrBlank(resort.lifts_display);
  return (
    <>
      <div className="fact-grid">
        {day != null || resort.day_ticket_dynamic ? (
          <div className="fact fact-wide">
            <span className="fact-label">{t("dayTicket")}</span>
            <span className="fact-value num">{day != null ? formatEur(lang, day) : t("dynamicPricing")}</span>
            <span className="fact-sub">
              {day != null && resort.day_ticket_season ? resort.day_ticket_season : null}
              {day != null && dayTicketIsEstimate(resort.day_ticket_season, day) ? <span className="badge">{t("estimate")}</span> : null}
              {resort.day_ticket_network_note ? <span className="badge">{t("networkPrice")}</span> : null}
            </span>
            {resort.day_ticket_network_note ? <span className="fact-source">{resort.day_ticket_network_note}</span> : null}
            <SourceLine source={resort.sources.dayTicket ?? resort.sources.dynamic} t={t} lang={lang} tourism={resort.via_tourism_site} />
          </div>
        ) : null}
        {top != null ? (
          <div className="fact">
            <span className="fact-label">{t("elevation")}</span>
            <span className="fact-value num">{top} m</span>
            {base != null ? <span className="fact-sub">{t("baseToTop", { base, top })}</span> : null}
          </div>
        ) : null}
        {drop != null && drop > 0 ? (
          <div className="fact">
            <span className="fact-label">{t("verticalDrop")}</span>
            <span className="fact-value num">{drop} m</span>
          </div>
        ) : null}
        {km != null ? (
          <div className="fact">
            <span className="fact-label">{t("slopeKm")}</span>
            <span className="fact-value num">{km} km</span>
          </div>
        ) : null}
        {lifts != null ? (
          <div className="fact">
            <span className="fact-label">{t("lifts")}</span>
            <span className="fact-value num">{lifts}</span>
          </div>
        ) : null}
        {resort.snowpark === true ? (
          <div className="fact">
            <span className="fact-label">{t("snowpark")}</span>
            <span className="fact-value">{t("yes")}</span>
          </div>
        ) : null}
        {resort.night_skiing === true ? (
          <div className="fact">
            <span className="fact-label">{t("nightSkiing")}</span>
            <span className="fact-value">{t("yes")}</span>
          </div>
        ) : null}
      </div>
      {resort.stats_aggregate ? <p className="hint">{t("statsAggregate")}</p> : null}
      <SourceRow
        sources={[
          resort.sources.slopes,
          resort.sources.lifts,
          resort.sources.elevation,
          resort.snowpark === true ? resort.sources.snowpark : undefined,
          resort.night_skiing === true ? resort.sources.nightSkiing : undefined,
        ]}
      />
      <label className="check">
        <input type="checkbox" checked={!share.hideRuns} onChange={() => updateShare({ hideRuns: !share.hideRuns })} />
        <span>{t("showRuns")}</span>
      </label>
    </>
  );
}

/** Several facts often share one source (OpenStreetMap). Show each source once. */
function SourceRow({ sources }: { sources: Array<FactRef | undefined> }) {
  const { t, lang } = useApp();
  const seen = new Set<string>();
  const unique = sources.filter((source): source is FactRef => {
    if (!source) return false;
    const key = `${source.sourceUrl ?? "osm"}|${source.checkedAt ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length === 0) return null;
  return (
    <p className="source-row">
      {unique.map((source) => (
        <SourceLine key={`${source.sourceUrl ?? "osm"}|${source.checkedAt ?? ""}`} source={source} t={t} lang={lang} />
      ))}
    </p>
  );
}

function SnowSection({ resort }: { resort: Resort }) {
  const { t, lang } = useApp();
  if (!resort.season_dates && !resort.snow_report && !resort.webcam && !resort.notes) return null;
  return (
    <section className="resort-section" aria-labelledby="resort-snow">
      <h3 id="resort-snow">{t("tabSnow")}</h3>
      {resort.season_dates ? (
        <p>
          <strong>{t("seasonDates")}: </strong>
          {resort.season_dates}
          <SourceLine source={resort.sources.season} t={t} lang={lang} />
        </p>
      ) : null}
      {resort.snow_report || resort.webcam ? (
        <div className="link-buttons">
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
      ) : null}
      {resort.notes ? (
        <p>
          <strong>{t("notes")}: </strong>
          {resort.notes}
        </p>
      ) : null}
    </section>
  );
}

function TravelSection({ resort }: { resort: Resort }) {
  const { t, home, lang } = useApp();
  const distance = home ? distanceKm(home, resort) : null;
  const km = distance != null ? formatKm(lang, distance) : "";
  const google = `https://www.google.com/maps/dir/?api=1&destination=${resort.lat},${resort.lon}`;
  const apple = `https://maps.apple.com/?daddr=${resort.lat},${resort.lon}`;
  return (
    <section className="resort-section" aria-labelledby="resort-travel">
      <h3 id="resort-travel">{t("tabTravelShort")}</h3>
      {home && km ? (
        <p>
          {t("distanceValue", { n: km })}
          <span className="fact-source">{t("straightLine")}</span>
        </p>
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
        <p>
          <strong>{t("transportNote")}: </strong>
          {resort.public_transport}
        </p>
      ) : null}
    </section>
  );
}

function LinksSection({ resort }: { resort: Resort }) {
  const { t, lang, copyLink, copyMessage } = useApp();
  const href = useLocalizedPath();
  const covered = resort.passes.map((id) => passById.get(id)).filter((pass): pass is Pass => pass != null);
  return (
    <section className="resort-section" aria-labelledby="resort-links">
      <h3 id="resort-links">{t("tabLinks")}</h3>
      {resort.website ? (
        <p>
          <a className="text-link" href={resort.website} target="_blank" rel="noopener noreferrer">
            {t("openWebsite")} ↗
          </a>
          <SourceLine source={resort.sources.website} t={t} lang={lang} tourism={resort.via_tourism_site} />
        </p>
      ) : null}
      {covered.length > 0 ? (
        <ul className="link-list">
          {covered.map((pass) => (
            <li key={pass.id}>
              <span className="swatch" style={{ background: pass.color }} />
              <a href={pass.url} target="_blank" rel="noopener noreferrer">
                {passShortName(pass)} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <AffiliateLinksBlock />
      <div className="row-actions">
        <button type="button" className="ghost" onClick={copyLink}>
          {copyMessage ?? t("share")}
        </button>
        <Link className="ghost" href={`${href("/contact")}?category=data-error&resort=${encodeURIComponent(resort.id)}`}>
          {t("reportMapIssue")}
        </Link>
      </div>
      <p className="fact-source">{t("dataFileDate", { date: formatDate(lang, generated) })}</p>
      <p className="fact-source">{t("osmSource")}</p>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </section>
  );
}
