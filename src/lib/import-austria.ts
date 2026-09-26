import { portalMarkersIn } from "./portals";
import { catalogSchema, type Pass, type ResortRecord } from "./schema";

/**
 * Austria 2026/27 import.
 *
 * Reads the research drop (imports/austria) plus the Part 1 resort file and
 * writes the app catalog. Rules are documented in README.md under "Import Austria".
 */

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export interface ImportStats {
  resortsInSource: number;
  shown: number;
  hidden: Record<string, number>;
  hiddenExamples: Record<string, string[]>;
  passesInSource: number;
  passesIncluded: string[];
  passesExcluded: string[];
  aggregateAreas: number;
  dynamicPricing: number;
  networkPrices: number;
  needsRecheck: number;
  viaTourismSite: number;
  legacyFieldsFilled: number;
  passResortLinks: number;
}

export interface ImportedCatalog {
  passes: { generated: string; passes: Pass[] };
  resorts: { generated: string; resorts: ResortRecord[] };
  osm: {
    licence: "ODbL-1.0";
    attribution: string;
    generated: string;
    places: Array<{ id: string; name: string; lat: number; lon: number; country: string; coordSource: string }>;
    resorts: Array<{
      id: string;
      lat: number;
      lon: number;
      coordSource: string;
      topElevationM: number | null;
      baseElevationM: number | null;
      slopeKm: number | null;
      lifts: number | null;
      snowpark: true | null;
      nightSkiing: true | null;
      abandoned: boolean;
      aggregate: boolean;
    }>;
  };
  stats: ImportStats;
}

interface Sourced<T> {
  value: T;
  sourceUrl?: string;
  checkedAt?: string;
  snippet?: string;
  note?: string;
  season?: string;
  derived?: boolean;
}

const META_PRICE_KEYS = new Set([
  "label",
  "period",
  "deadline",
  "validFrom",
  "membershipRequired",
  "familyRates",
  "columnMappingNote",
  "labelWarning",
  "crossCheck",
  "priceCaveat",
]);

const SKIP_PRICE_KEYS = new Set([
  "family",
  "family1Adult",
  "family2Adults",
  "jungfamilie",
  "disabled60",
  "membershipRequired",
]);

const RESTRICTED_PASS_IDS = new Set(["steiermark-joker", "wildpass-saisonkarte-winter"]);

const COLORS = [
  "#1f5fd1",
  "#1a9a3a",
  "#d4532b",
  "#7a3ff0",
  "#0e8f8a",
  "#c43b6e",
  "#b45309",
  "#2458a8",
  "#3d6b2f",
  "#9333ea",
  "#be123c",
  "#0369a1",
  "#4d7c0f",
  "#a16207",
  "#4338ca",
  "#0e7490",
  "#9f1239",
  "#166534",
  "#7c3aed",
  "#0f766e",
  "#9a3412",
];

const REGION_NAME: Record<string, string> = {
  Niederösterreich: "Lower Austria",
  Steiermark: "Styria",
  Kärnten: "Carinthia",
  Salzburg: "Salzburg",
  Oberösterreich: "Upper Austria",
  Tirol: "Tirol",
  Vorarlberg: "Vorarlberg",
  Wien: "Vienna",
  Burgenland: "Burgenland",
  Bavaria: "Bavaria",
};

const PLACES = [
  {
    id: "vienna",
    name: "Vienna",
    lat: 48.2084,
    lon: 16.3725,
    country: "AT",
    coordSource: "OpenStreetMap city centre",
  },
  {
    id: "innsbruck",
    name: "Innsbruck",
    lat: 47.2654,
    lon: 11.3928,
    country: "AT",
    coordSource: "OpenStreetMap city centre",
  },
];

interface DraftBracket {
  key: string;
  label: string;
  from: number | null;
  to: number | null;
  open: boolean;
  derived: boolean;
  overlay: boolean;
  omit: boolean;
  priceKeys: string[];
  periods: Array<{
    price: number;
    until: string | null;
    sourceUrl: string;
    checkedAt: string;
    snippet?: string;
  }>;
}

interface RawPass {
  id: string;
  name: Sourced<string>;
  officialUrl: Sourced<string>;
  season?: string;
  ageBrackets: Record<string, Sourced<Record<string, unknown>> | null>;
  prices: {
    earlyBird?: Record<string, unknown> | null;
    otherPhases?: Array<Record<string, unknown>>;
    regular?: Record<string, unknown> | null;
    earlyBirdWithLoyaltyBonus?: unknown;
    variants?: unknown;
    packages?: unknown;
    priceCaveat?: Sourced<string>;
  };
  notes?: Array<Sourced<string>>;
  [key: string]: unknown;
}

interface RawResort {
  id: string;
  name: string | null;
  bundesland: string[];
  dataQualityFlags?: string[];
  official?: Record<string, Sourced<unknown> | null>;
  osm: {
    osmIds?: string[];
    centroid: { lat: number; lon: number };
    baseElevationM: number | null;
    topElevationM: number | null;
    liftCount: number | null;
    downhillPisteKm: number | null;
    countries?: string[];
    placesAT_withLocality?: number;
    placesForeign_withLocality?: number;
    websites?: string[];
    dataTimestamp?: string;
    geometryType?: string;
  };
}

interface ResortBuild {
  rawId: string;
  id: string;
  name: string;
  region: string;
  hiddenReason: string | null;
  abandoned: boolean;
  aggregate: boolean;
  passes: Map<string, { sourceUrl: string; checkedAt: string; confidence?: string }>;
  official: RawResort["official"];
  osm: RawResort["osm"];
  flags: string[];
  notes: string[];
  needsRecheck: boolean;
  viaTourismSite: boolean;
  networkPriceNote: string | null;
  dynamic: Sourced<true> | null;
  legacyFilled: number;
}

export function publicResortId(rawId: string): string {
  const slug = rawId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw new ImportError(`Resort id ${rawId} cannot be turned into a public id`);
  return slug;
}

export function importAustria(input: {
  passes: unknown;
  resorts: unknown;
  legacyResorts: unknown;
  includeRestrictedPasses: boolean;
}): ImportedCatalog {
  const passesRoot = asRecord(input.passes, "passes.json");
  const resortsRoot = asRecord(input.resorts, "resorts.json");
  const legacyRoot = asRecord(input.legacyResorts, "legacy resorts");
  const rawPasses = asArray(passesRoot.passes, "passes").map((item, index) => asPass(item, index));
  const rawResorts = asArray(resortsRoot.resorts, "resorts").map((item, index) => asResort(item, index));

  const restrictedFound = rawPasses.filter((pass) => isRestrictedPass(pass)).map((pass) => pass.id);
  const unexpected = symmetricDiff(restrictedFound, [...RESTRICTED_PASS_IDS]);
  if (unexpected.length > 0) {
    throw new ImportError(
      `Restricted-pass set changed (${unexpected.join(", ")}). Update RESTRICTED_PASS_IDS after reviewing the imprint notes.`,
    );
  }

  const published = rawPasses.filter((pass) => input.includeRestrictedPasses || !RESTRICTED_PASS_IDS.has(pass.id));
  const excluded = rawPasses.filter((pass) => !published.includes(pass)).map((pass) => pass.id);
  const colorById = new Map(rawPasses.map((pass, index) => [pass.id, COLORS[index % COLORS.length]]));
  const passes = published.map((pass) => toPass(pass, colorById.get(pass.id) ?? COLORS[0]));

  const resortByNorm = new Map<string, ResortBuild>();
  const builds: ResortBuild[] = [];
  for (const raw of rawResorts) {
    const build = shellResort(raw);
    builds.push(build);
    for (const key of osmKeys(raw)) {
      if (resortByNorm.has(key) && resortByNorm.get(key) !== build) {
        throw new ImportError(`OSM id ${key} is used by two resorts`);
      }
      resortByNorm.set(key, build);
    }
  }

  const publishedIds = new Set(passes.map((pass) => pass.id));
  let passResortLinks = 0;
  for (const pass of rawPasses) {
    if (!publishedIds.has(pass.id)) continue;
    const covered = asArray(pass.coveredResorts, `${pass.id} coveredResorts`);
    for (const entry of covered) {
      const record = asRecord(entry, `${pass.id} covered resort`);
      const nameFact = asSourced(record.name, `${pass.id} covered name`);
      const osmList = Array.isArray(record.osm) ? record.osm : [];
      for (const match of osmList) {
        const item = asRecord(match, `${pass.id} osm match`);
        const ids = Array.isArray(item.osmSourceIds) ? item.osmSourceIds.map(String) : [];
        const confidence = typeof item.matchConfidence === "string" ? item.matchConfidence : undefined;
        for (const osmId of ids) {
          const target = resortByNorm.get(normOsm(osmId));
          if (!target) continue;
          const source = factSource(nameFact, `${pass.id} ${osmId}`);
          target.passes.set(pass.id, {
            sourceUrl: source.sourceUrl,
            checkedAt: source.checkedAt,
            confidence,
          });
          passResortLinks += 1;
        }
      }
    }
  }

  applyVisibility(builds, resortByNorm);
  const legacyFilled = mergeLegacy(builds, legacyRoot);

  const generatedResorts = isoDay(String(resortsRoot.generatedAt ?? ""), "resorts.generatedAt");
  const generatedPasses = isoDay(String(passesRoot.generatedAt ?? ""), "passes.generatedAt");

  const resortRecords: ResortRecord[] = [];
  const osmResorts: ImportedCatalog["osm"]["resorts"] = [];
  const hidden: Record<string, number> = {};
  const hiddenExamples: Record<string, string[]> = {};
  let aggregateAreas = 0;
  let dynamicPricing = 0;
  let networkPrices = 0;
  let needsRecheck = 0;
  let viaTourismSite = 0;

  const seen = new Set<string>();
  for (const build of builds.sort((a, b) => a.id.localeCompare(b.id))) {
    if (seen.has(build.id)) throw new ImportError(`Duplicate public id ${build.id}`);
    seen.add(build.id);
    if (build.hiddenReason) {
      hidden[build.hiddenReason] = (hidden[build.hiddenReason] ?? 0) + 1;
      const list = hiddenExamples[build.hiddenReason] ?? [];
      if (list.length < 8) list.push(build.name || build.rawId);
      hiddenExamples[build.hiddenReason] = list;
    }
    if (build.aggregate && !build.hiddenReason) aggregateAreas += 1;
    if (build.dynamic) dynamicPricing += 1;
    if (build.networkPriceNote) networkPrices += 1;
    if (build.needsRecheck) needsRecheck += 1;
    if (build.viaTourismSite) viaTourismSite += 1;

    const official = build.official ?? {};
    const day = official.dayTicketAdult;
    const dayValue = day && typeof day.value === "number" ? day : null;
    const website = urlFact(official.website, `${build.id} website`);
    const season = seasonFact(official.seasonStart, official.seasonEnd, build.id);
    const snowpark = trueFact(official.snowpark, `${build.id} snowpark`);
    const night = trueFact(official.nightSkiing, `${build.id} nightSkiing`);
    const snowReport = urlFact(official.snowReportUrl, `${build.id} snow report`);
    const webcam = urlFact(official.webcamUrl, `${build.id} webcam`);

    resortRecords.push({
      id: build.id,
      name: build.name || "Unnamed area",
      region: build.region,
      country: "AT",
      verification: build.hiddenReason ? "unverified" : "verified",
      hiddenReason: build.hiddenReason,
      passes: [...build.passes.entries()]
        .filter(([id]) => publishedIds.has(id))
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([id, coverage]) => ({
          id,
          sourceUrl: coverage.sourceUrl,
          checkedAt: coverage.checkedAt,
        })),
      website,
      dayTicket: dayValue
        ? {
            value: {
              eur: dayValue.value as number,
              season: typeof dayValue.season === "string" && dayValue.season ? dayValue.season : "unspecified",
            },
            ...factSource(dayValue, `${build.id} day ticket`),
          }
        : null,
      dayTicketDynamic: build.dynamic
        ? { value: true as const, ...factSource(build.dynamic, `${build.id} dynamic pricing`) }
        : null,
      seasonDates: season,
      publicTransport: null,
      snowpark,
      nightSkiing: night,
      snowReport,
      webcam,
      networkPriceNote: build.networkPriceNote,
      needsRecheck: build.needsRecheck,
      viaTourismSite: build.viaTourismSite,
      notes: build.notes.length > 0 ? build.notes.join(" ") : null,
    });

    const centroid = build.osm.centroid;
    if (!centroid || typeof centroid.lat !== "number" || typeof centroid.lon !== "number") {
      throw new ImportError(`${build.rawId} has no centroid`);
    }
    osmResorts.push({
      id: build.id,
      lat: roundCoord(centroid.lat),
      lon: roundCoord(centroid.lon),
      coordSource: "OpenSkiMap / OpenSkiData centroid (OpenStreetMap, ODbL)",
      topElevationM: numOrNull(build.osm.topElevationM),
      baseElevationM: numOrNull(build.osm.baseElevationM),
      slopeKm: numOrNull(build.osm.downhillPisteKm),
      lifts: build.osm.liftCount == null ? null : Math.round(build.osm.liftCount),
      snowpark: null,
      nightSkiing: null,
      abandoned: build.abandoned,
      aggregate: build.aggregate,
    });
  }

  const catalog: ImportedCatalog = {
    passes: { generated: generatedPasses, passes },
    resorts: { generated: generatedResorts, resorts: resortRecords },
    osm: {
      licence: "ODbL-1.0",
      attribution:
        "© OpenStreetMap contributors, OpenSkiMap.org / OpenSkiData. Coordinates and statistics in this file are derived from OpenStreetMap (ODbL 1.0).",
      generated: generatedResorts,
      places: PLACES,
      resorts: osmResorts,
    },
    stats: {
      resortsInSource: rawResorts.length,
      shown: resortRecords.filter((resort) => resort.verification === "verified").length,
      hidden,
      hiddenExamples,
      passesInSource: rawPasses.length,
      passesIncluded: passes.map((pass) => pass.id),
      passesExcluded: excluded,
      aggregateAreas,
      dynamicPricing,
      networkPrices,
      needsRecheck,
      viaTourismSite,
      legacyFieldsFilled: legacyFilled,
      passResortLinks,
    },
  };

  const parsed = catalogSchema.safeParse({
    passes: catalog.passes,
    resorts: catalog.resorts,
    osm: catalog.osm,
  });
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 12)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new ImportError(`Imported catalog failed schema validation:\n${issues}`);
  }
  const serialized = JSON.stringify(catalog);
  const markers = portalMarkersIn(serialized);
  if (markers.length > 0) throw new ImportError(`Imported catalog contains aggregator domains: ${markers.join(", ")}`);
  return catalog;
}

function toPass(pass: RawPass, color: string): Pass {
  const name = textFact(pass.name, `${pass.id} name`);
  const url = textFact(pass.officialUrl, `${pass.id} url`);
  assertHttp(url.value, `${pass.id} official url`);
  const source = factSource(pass.officialUrl, `${pass.id} source`);
  const drafts = bracketsFor(pass);
  const phases = pricePhases(pass);
  const presale = phases[0]?.from ?? null;

  for (const phase of phases) {
    for (const [key, raw] of Object.entries(phase.body)) {
      if (META_PRICE_KEYS.has(key) || SKIP_PRICE_KEYS.has(key) || /^disabled/i.test(key) || /^family/i.test(key)) continue;
      const amount = priceAmount(raw);
      if (amount == null) {
        if (isRecord(raw) && typeof raw.value === "string" && /[€]|euro/i.test(raw.value)) {
          throw new ImportError(`${pass.id} ${key} price is not a number`);
        }
        continue;
      }
      const draft = findDraft(drafts, key);
      if (!draft) throw new ImportError(`${pass.id} has unmapped price key ${key}`);
      if (draft.omit) continue;
      const fact = asSourced(raw, `${pass.id} ${key}`);
      const sourced = factSource(fact, `${pass.id} ${key}`);
      draft.periods.push({
        price: amount,
        until: phase.until,
        sourceUrl: sourced.sourceUrl,
        checkedAt: sourced.checkedAt,
        snippet: sourced.snippet,
      });
    }
  }

  for (const draft of drafts) {
    if (draft.omit) continue;
    if (draft.periods.length === 0) {
      if (draft.overlay || draft.open || draft.key === "freeUnder") continue;
      throw new ImportError(`${pass.id} bracket ${draft.label} has birth years but no price`);
    }
  }

  const kept = drafts.filter((draft) => !draft.omit && draft.periods.length > 0);
  if (kept.length === 0) throw new ImportError(`${pass.id} has no priced brackets`);
  shrinkOverlaps(kept, pass.id);

  const brackets = kept.map((draft) => ({
    label: draft.label,
    birth_year_from: draft.open ? null : draft.from,
    birth_year_to: draft.open ? null : draft.to,
    ...(draft.derived ? { note: "Birth-year range is implied by the neighbouring published brackets." } : {}),
  }));
  const periods = kept.flatMap((draft) =>
    draft.periods
      .sort((a, b) => {
        if (a.until == null) return 1;
        if (b.until == null) return -1;
        return a.until.localeCompare(b.until);
      })
      .map((period) => ({
        bracket: draft.label,
        price_eur: period.price,
        valid_until: period.until,
        source: {
          sourceUrl: period.sourceUrl,
          checkedAt: period.checkedAt,
          ...(period.snippet ? { snippet: period.snippet } : {}),
        },
      })),
  );

  const caveat = pass.prices.priceCaveat ? textFact(pass.prices.priceCaveat, `${pass.id} caveat`).value : null;
  const provisional = Boolean(caveat && /provisional|vorläufig|vorlaufig/i.test(caveat));
  const noteParts = [
    presale ? `Presale from ${presale}.` : null,
    `Season ${pass.season ?? "2026/27"}. Prices follow this pass's own birth-year brackets and the purchase date.`,
    "Where this pass publishes no bracket for a birth year, the price is unavailable.",
    caveat,
    pass.prices.variants || pass.prices.packages || pass.prices.earlyBirdWithLoyaltyBonus
      ? "Family, weekday, and loyalty variants are not applied automatically."
      : null,
    drafts.some((draft) => draft.omit)
      ? "Proof-required tariffs (student, apprentice, disability, or a local youth card) are not selected from a birth year."
      : null,
  ].filter((part): part is string => Boolean(part));

  return {
    id: pass.id,
    name: name.value,
    color,
    price_note: noteParts.join(" "),
    url: url.value,
    provisional,
    restricted: RESTRICTED_PASS_IDS.has(pass.id),
    source,
    pricing: { brackets, periods },
  };
}

function bracketsFor(pass: RawPass): DraftBracket[] {
  const drafts: DraftBracket[] = [];
  for (const [field, raw] of Object.entries(pass.ageBrackets ?? {})) {
    if (!raw) continue;
    const fact = asSourced(raw, `${pass.id} ${field}`);
    const value = asRecord(fact.value, `${pass.id} ${field} value`);
    const overlay = isProofOverlay(field, value);
    pushBracket(drafts, field, value, Boolean(fact.derived) || value.derived === true, overlay, false);
    if (value.also && typeof value.also === "object") {
      const also = asRecord(value.also, `${pass.id} ${field} also`);
      pushBracket(drafts, `${field}-also`, also, false, false, true);
    }
  }
  for (const draft of drafts) {
    if (!draft.overlay) continue;
    const overlapsKept = drafts.some((other) => !other.overlay && !other.open && rangesOverlap(draft, other));
    draft.omit = overlapsKept;
  }
  return drafts;
}

function pushBracket(
  drafts: DraftBracket[],
  field: string,
  value: Record<string, unknown>,
  derived: boolean,
  overlay: boolean,
  fromAlso: boolean,
): void {
  const years = birthSpan(value);
  const labelBase = typeof value.label === "string" && value.label.trim() ? value.label.trim() : field;
  if (!years) {
    if (value.minAge == null && value.maxAge == null && value.bornFrom == null) return;
    if (overlay) return;
    drafts.push({
      key: field,
      label: `${labelBase} (age at purchase)`,
      from: null,
      to: null,
      open: true,
      derived,
      overlay,
      omit: false,
      priceKeys: priceKeysFor(field, value, null),
      periods: [],
    });
    return;
  }
  const span = formatSpan(years.from, years.to);
  const key = fromAlso ? `${field}:${years.from ?? ""}:${years.to ?? ""}` : field;
  drafts.push({
    key,
    label: `${labelBase} (${span})`,
    from: years.from,
    to: years.to,
    open: false,
    derived,
    overlay,
    omit: false,
    priceKeys: priceKeysFor(field, value, years),
    periods: [],
  });
}

function priceKeysFor(
  field: string,
  value: Record<string, unknown>,
  years: { from: number | null; to: number | null } | null,
): string[] {
  if (field.startsWith("child") && value.also) {
    return years ? [`child_${years.from}_${years.to}`] : ["child"];
  }
  if (field.startsWith("child-also") && years) return [`child_${years.from}_${years.to}`];
  if (field === "child" || field.startsWith("child")) return ["child"];
  if (field.startsWith("senior-also")) return ["superSenior", "seniorII"];
  if (field === "senior") return ["senior"];
  if (field === "seniorAktiv" || field === "seniorII") return [field === "seniorAktiv" ? "seniorAktiv" : "seniorII"];
  if (field === "freeUnder") return ["freeUnder", "smallChild"];
  if (field === "youth") return ["youth"];
  if (field === "adult") return ["adult"];
  if (field === "u25_u28_student") {
    const label = String(value.label ?? "");
    if (/^U28\b/i.test(label)) return ["u28", "u25_u28_student"];
    if (/^U2[35]\b/i.test(label)) return ["u25", "u25_student", "u25_u28_student"];
    return ["u25", "u28", "u25_student", "u25_u28_student", "student_trainee"];
  }
  return [field];
}

function findDraft(drafts: DraftBracket[], key: string): DraftBracket | null {
  return drafts.find((draft) => draft.priceKeys.includes(key) && !draft.omit) ?? drafts.find((draft) => draft.priceKeys.includes(key)) ?? null;
}

function shrinkOverlaps(drafts: DraftBracket[], passId: string): void {
  const bounded = drafts.filter((draft) => !draft.open);
  for (let guard = 0; guard < 12; guard += 1) {
    let changed = false;
    for (let i = 0; i < bounded.length; i += 1) {
      for (let j = i + 1; j < bounded.length; j += 1) {
        const a = bounded[i];
        const b = bounded[j];
        if (!rangesOverlap(a, b)) continue;
        const shrunk = shrinkPair(a, b);
        if (!shrunk) {
          throw new ImportError(
            `${passId} birth-year brackets overlap and cannot be split without guessing: ${a.label} and ${b.label}`,
          );
        }
        changed = true;
      }
    }
    if (!changed) return;
  }
  throw new ImportError(`${passId} birth-year brackets still overlap after narrowing`);
}

function shrinkPair(a: DraftBracket, b: DraftBracket): boolean {
  if (contains(a, b) && !sameRange(a, b)) return cutOut(a, b);
  if (contains(b, a) && !sameRange(a, b)) return cutOut(b, a);
  return false;
}

function cutOut(outer: DraftBracket, inner: DraftBracket): boolean {
  const outerFrom = outer.from ?? Number.NEGATIVE_INFINITY;
  const outerTo = outer.to ?? Number.POSITIVE_INFINITY;
  const innerFrom = inner.from ?? Number.NEGATIVE_INFINITY;
  const innerTo = inner.to ?? Number.POSITIVE_INFINITY;
  if (innerFrom === outerFrom && innerTo < outerTo && inner.to != null) {
    outer.from = inner.to + 1;
    outer.derived = true;
    outer.label = relabel(outer);
    return true;
  }
  if (innerTo === outerTo && innerFrom > outerFrom && inner.from != null) {
    outer.to = inner.from - 1;
    outer.derived = true;
    outer.label = relabel(outer);
    return true;
  }
  return false;
}

function relabel(draft: DraftBracket): string {
  const base = draft.label.replace(/\s*\([^)]*\)\s*$/, "");
  return `${base} (${formatSpan(draft.from, draft.to)})`;
}

function rangesOverlap(a: DraftBracket, b: DraftBracket): boolean {
  if (a.open || b.open) return false;
  const aFrom = a.from ?? Number.NEGATIVE_INFINITY;
  const aTo = a.to ?? Number.POSITIVE_INFINITY;
  const bFrom = b.from ?? Number.NEGATIVE_INFINITY;
  const bTo = b.to ?? Number.POSITIVE_INFINITY;
  return aFrom <= bTo && bFrom <= aTo;
}

function contains(outer: DraftBracket, inner: DraftBracket): boolean {
  const outerFrom = outer.from ?? Number.NEGATIVE_INFINITY;
  const outerTo = outer.to ?? Number.POSITIVE_INFINITY;
  const innerFrom = inner.from ?? Number.NEGATIVE_INFINITY;
  const innerTo = inner.to ?? Number.POSITIVE_INFINITY;
  return outerFrom <= innerFrom && outerTo >= innerTo;
}

function sameRange(a: DraftBracket, b: DraftBracket): boolean {
  return a.from === b.from && a.to === b.to;
}

function birthSpan(value: Record<string, unknown>): { from: number | null; to: number | null } | null {
  const years = value.birthYears;
  if (Array.isArray(years) && years.length === 2) {
    return { from: years[0] == null ? null : Number(years[0]), to: years[1] == null ? null : Number(years[1]) };
  }
  if (typeof value.bornFrom === "number") return { from: value.bornFrom, to: null };
  return null;
}

function formatSpan(from: number | null, to: number | null): string {
  if (from == null && to == null) return "age at purchase";
  if (from == null) return `–${to}`;
  if (to == null) return `${from}–`;
  return `${from}–${to}`;
}

function isProofOverlay(field: string, value: Record<string, unknown>): boolean {
  if (field === "disabled60") return true;
  if (field !== "u25_u28_student") return false;
  const label = String(value.label ?? "");
  if (/^(U2[358]|Jugend|Erwachsene|Kinder|Kind|Senior)/i.test(label.trim())) return false;
  const text = `${label} ${value.condition ?? ""} ${value.rule ?? ""} ${value.note ?? ""}`.toLowerCase();
  return /student|azubi|lehrling|schüler|auszubild|behinder|aha|familie|family|ausweis|photo id|nachweis/.test(text);
}

interface Phase {
  from: string | null;
  until: string | null;
  body: Record<string, unknown>;
}

function pricePhases(pass: RawPass): Phase[] {
  const phases: Phase[] = [];
  const early = pass.prices.earlyBird;
  if (early && typeof early === "object") phases.push(phaseFrom(early, `${pass.id} early bird`));
  for (const [index, phase] of (pass.prices.otherPhases ?? []).entries()) {
    phases.push(phaseFrom(phase, `${pass.id} phase ${index}`));
  }
  const regular = pass.prices.regular;
  if (regular && typeof regular === "object") {
    const built = phaseFrom(regular, `${pass.id} regular`);
    built.until = null;
    phases.push(built);
  }
  const dated = phases.filter((phase) => phase.until);
  const untils = dated.map((phase) => phase.until);
  if (new Set(untils).size !== untils.length) {
    throw new ImportError(`${pass.id} repeats a price deadline`);
  }
  return phases.filter((phase) =>
    Object.entries(phase.body).some(
      ([key, raw]) =>
        !META_PRICE_KEYS.has(key) && !SKIP_PRICE_KEYS.has(key) && !/^disabled/i.test(key) && !/^family/i.test(key) && priceAmount(raw) != null,
    ),
  );
}

function phaseFrom(body: Record<string, unknown>, where: string): Phase {
  const deadline = body.deadline;
  let until: string | null = null;
  if (isRecord(deadline) && typeof deadline.value === "string" && /^\d{4}-\d{2}-\d{2}/.test(deadline.value)) {
    until = deadline.value.slice(0, 10);
  }
  const period = body.period;
  let from: string | null = null;
  if (isRecord(period) && isRecord(period.value)) {
    if (!until && typeof period.value.to === "string") until = isoDay(period.value.to, `${where} period end`);
    if (typeof period.value.from === "string") from = isoDay(period.value.from, `${where} period start`);
  }
  const validFrom = body.validFrom;
  if (isRecord(validFrom) && typeof validFrom.value === "string") from = isoDay(validFrom.value, `${where} validFrom`);
  return { from, until, body };
}

function isRestrictedPass(pass: RawPass): boolean {
  const notes = JSON.stringify(pass.notes ?? []);
  return /LEGAL FLAG|flag for legal review|Speicherung in Datenbanken|ohne schriftliche Genehmigung/i.test(notes);
}

function shellResort(raw: RawResort): ResortBuild {
  const flags = raw.dataQualityFlags ?? [];
  const official = raw.official ?? {};
  const dynamic = dynamicFact(official);
  const dayNote = noteOf(official.dayTicketAdult);
  const network = networkNote(dayNote);
  const recheck = needsRecheck(official);
  const tourism = viaTourism(official);
  return {
    rawId: raw.id,
    id: publicResortId(raw.id),
    name: raw.name?.trim() || "",
    region: regionOf(raw.bundesland),
    hiddenReason: null,
    abandoned: false,
    aggregate: flags.some((flag) => flag.startsWith("contains sub-area")),
    passes: new Map(),
    official,
    osm: raw.osm,
    flags,
    notes: [],
    needsRecheck: recheck,
    viaTourismSite: tourism,
    networkPriceNote: network,
    dynamic,
    legacyFilled: 0,
  };
}

function applyVisibility(builds: ResortBuild[], byNorm: Map<string, ResortBuild>): void {
  const byRaw = new Map(builds.map((build) => [build.rawId, build]));
  for (const build of builds) {
    const reason = hideReason(build);
    if (reason === "closed") {
      build.abandoned = true;
      build.notes.push("Permanently closed. The operator announced the end of lift operation.");
      continue;
    }
    if (!reason) continue;
    build.hiddenReason = reason;
    if (reason === "duplicate") {
      const target = duplicateTarget(build, byRaw, byNorm);
      if (target && target !== build) {
        for (const [id, coverage] of build.passes) {
          if (!target.passes.has(id)) target.passes.set(id, coverage);
        }
        build.passes.clear();
      }
    }
    if (reason === "sub-feature" && /planai/i.test(build.name)) {
      const planai =
        byRaw.get("osm:way/341898615") ??
        builds.find((item) => /planai/i.test(item.name) && item !== build && item.hiddenReason == null);
      if (planai) {
        planai.notes.push("Horsefeathers Superpark Planai is a park inside this area, not a separate resort.");
      }
    }
  }
}

function hideReason(build: ResortBuild): string | null {
  const lifts = build.osm.liftCount ?? 0;
  const km = build.osm.downhillPisteKm ?? 0;
  const point = build.osm.geometryType === "Point";
  const unnamed = !build.name || build.flags.includes("unnamed");
  if (unnamed) return "unnamed";
  if (build.flags.some((flag) => flag.startsWith("name suggests sub-feature")) || /horsefeathers superpark/i.test(build.name)) {
    return "sub-feature";
  }
  if (/schizentrum rettenbach/i.test(build.name) || hostsOf(build).some((host) => host.endsWith("sz-rettenbach.at"))) {
    return "grass-ski";
  }
  if (build.flags.some((flag) => flag.startsWith("duplicate name")) && lifts === 0) return "duplicate";
  if (mostlyOutside(build)) return "outside-austria";
  if (closedFact(build.official?.operatingNote)) return "closed";
  if (lifts === 0 && km === 0 && !build.aggregate) return "not-a-resort";
  const officialSite = Boolean(build.official?.website && typeof build.official.website.value === "string");
  if (point && lifts <= 1 && km < 1 && build.passes.size === 0 && !officialSite && !build.official?.dayTicketAdult) {
    return "tiny-point";
  }
  return null;
}

/** Areas that sit mostly outside Austria. See README. */
export function mostlyOutside(build: {
  rawId: string;
  flags: string[];
  osm: RawResort["osm"];
  official?: RawResort["official"];
}): boolean {
  if (build.rawId === "osm:way/660211219" || build.rawId === "osm:relation/18841519") return true;
  const countries = build.osm.countries ?? [];
  if (!countries.some((country) => country !== "AT")) return false;
  const austrianSite = hostsOf(build).some((host) => host.endsWith(".at") || host.endsWith(".tirol"));
  if (austrianSite) return false;
  const atPlaces = build.osm.placesAT_withLocality ?? 0;
  const flagged = build.flags.some((flag) => flag.startsWith("verify country"));
  return flagged || atPlaces === 0;
}

function duplicateTarget(
  build: ResortBuild,
  byRaw: Map<string, ResortBuild>,
  byNorm: Map<string, ResortBuild>,
): ResortBuild | null {
  const flag = build.flags.find((item) => item.startsWith("duplicate name in AT:"));
  if (!flag) return null;
  const rawId = flag.slice("duplicate name in AT:".length).trim();
  return byRaw.get(rawId) ?? byNorm.get(normOsm(rawId)) ?? null;
}

function mergeLegacy(builds: ResortBuild[], legacyRoot: Record<string, unknown>): number {
  const legacy = asArray(legacyRoot.resorts, "legacy resorts").map((item) => asRecord(item, "legacy resort"));
  let filled = 0;
  for (const build of builds) {
    if (!build.name) continue;
    const match = matchLegacy(build.name, legacy);
    if (!match) continue;
    filled += fillFromLegacy(build, match);
  }
  return filled;
}

function fillFromLegacy(build: ResortBuild, legacy: Record<string, unknown>): number {
  let filled = 0;
  const official = build.official ?? {};
  build.official = official;
  if (!official.website && isSourcedUrl(legacy.website)) {
    official.website = legacy.website as Sourced<unknown>;
    filled += 1;
  }
  if (!official.dayTicketAdult && isSourcedDayTicket(legacy.dayTicket)) {
    const day = legacy.dayTicket as { value: { eur: number; season: string }; sourceUrl: string; checkedAt: string; snippet?: string };
    official.dayTicketAdult = {
      value: day.value.eur,
      season: day.value.season,
      sourceUrl: day.sourceUrl,
      checkedAt: day.checkedAt,
      snippet: day.snippet,
      note: "Kept from the previous catalog; the new drop has no day ticket for this area.",
    };
    filled += 1;
  }
  if (!official.snowpark && isSourcedTrue(legacy.snowpark)) {
    official.snowpark = legacy.snowpark as Sourced<unknown>;
    filled += 1;
  }
  if (!official.nightSkiing && isSourcedTrue(legacy.nightSkiing)) {
    official.nightSkiing = legacy.nightSkiing as Sourced<unknown>;
    filled += 1;
  }
  build.legacyFilled = filled;
  return filled;
}

function matchLegacy(name: string, legacy: Array<Record<string, unknown>>): Record<string, unknown> | null {
  const folded = fold(name);
  let best: { score: number; row: Record<string, unknown> } | null = null;
  let second = 0;
  for (const row of legacy) {
    const legacyName = typeof row.name === "string" ? row.name : "";
    const score = nameScore(folded, fold(legacyName));
    if (!best || score > best.score) {
      second = best?.score ?? 0;
      best = { score, row };
    } else if (score > second) second = score;
  }
  if (!best || best.score < 0.62) return null;
  if (second >= best.score - 0.12 && best.score < 0.99) return null;
  return best.row;
}

function nameScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  const shared = ta.filter((token) => setB.has(token));
  return shared.length / new Set([...ta, ...tb]).size;
}

function tokens(value: string): string[] {
  const stop = new Set(["ski", "skigebiet", "bergbahn", "bergbahnen", "lifte", "lift", "arena", "und", "am", "im", "der", "die", "das"]);
  return value.split(" ").filter((token) => token.length > 2 && !stop.has(token));
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function regionOf(states: string[]): string {
  const names = (states ?? []).map((state) => REGION_NAME[state] ?? state);
  return names.join(" / ") || "Austria";
}

function dynamicFact(official: RawResort["official"]): Sourced<true> | null {
  if (!official) return null;
  const day = official.dayTicketAdult;
  if (day && typeof day.value === "number") return null;
  const crawl = official.crawlNote;
  const blob = `${crawl?.value ?? ""} ${day?.note ?? ""}`;
  if (!/dynamic/i.test(blob)) return null;
  const source = crawl?.sourceUrl ? crawl : day;
  if (!source?.sourceUrl) return null;
  return {
    value: true,
    sourceUrl: source.sourceUrl,
    checkedAt: source.checkedAt,
    snippet: source.snippet,
    note: typeof crawl?.value === "string" ? crawl.value : day?.note,
  };
}

function networkNote(note: string): string | null {
  if (!note) return null;
  if (/joint ticket|ticketverbund|gesamtskigebiet|inherited from umbrella|tarifverbund|ski arlberg joint|same operator\/joint/i.test(note)) {
    return note;
  }
  return null;
}

function needsRecheck(official: RawResort["official"]): boolean {
  if (!official) return false;
  for (const fact of Object.values(official)) {
    if (!fact) continue;
    const blob = `${fact.note ?? ""} ${fact.season ?? ""} ${typeof fact.value === "string" ? fact.value : ""}`;
    if (/vorläufig|vorlaufig|preliminary|ambiguous|coming soon|no season label|table header|likely 20/i.test(blob)) return true;
    if (fact.season === "ambiguous" || fact.season === "unspecified") return true;
  }
  return false;
}

function viaTourism(official: RawResort["official"]): boolean {
  if (!official) return false;
  for (const fact of Object.values(official)) {
    if (!fact) continue;
    const blob = `${fact.note ?? ""} ${fact.sourceUrl ?? ""}`;
    if (/tourism/i.test(blob)) return true;
  }
  return false;
}

function closedFact(fact: Sourced<unknown> | null | undefined): boolean {
  return typeof fact?.value === "string" && /permanently closed/i.test(fact.value);
}

function noteOf(fact: Sourced<unknown> | null | undefined): string {
  return typeof fact?.note === "string" ? fact.note : "";
}

function hostsOf(build: { osm: { websites?: string[] }; official?: RawResort["official"] }): string[] {
  const urls = [...(build.osm.websites ?? [])];
  const website = build.official?.website;
  if (typeof website?.value === "string") urls.push(website.value);
  return urls.map((url) => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  });
}

function osmKeys(raw: RawResort): string[] {
  const keys = new Set<string>([normOsm(raw.id)]);
  for (const id of raw.osm.osmIds ?? []) keys.add(normOsm(id));
  return [...keys];
}

function normOsm(id: string): string {
  return id.replace(/^osm:/, "");
}

function urlFact(fact: Sourced<unknown> | null | undefined, where: string): ResortRecord["website"] {
  if (!fact || typeof fact.value !== "string" || !fact.value) return null;
  assertHttp(fact.value, where);
  return { value: fact.value, ...factSource(fact, where) };
}

function trueFact(fact: Sourced<unknown> | null | undefined, where: string): ResortRecord["snowpark"] {
  if (!fact || fact.value !== true) return null;
  return { value: true, ...factSource(fact, where) };
}

function seasonFact(
  start: Sourced<unknown> | null | undefined,
  end: Sourced<unknown> | null | undefined,
  id: string,
): ResortRecord["seasonDates"] {
  const from = typeof start?.value === "string" ? start.value : null;
  const to = typeof end?.value === "string" ? end.value : null;
  if (!from && !to) return null;
  const value = [from, to].filter(Boolean).join(" – ");
  const source = start?.sourceUrl ? start : end;
  if (!source) throw new ImportError(`${id} season dates have no source`);
  return { value, ...factSource(source, `${id} season`) };
}

function textFact(fact: Sourced<unknown>, where: string): Sourced<string> {
  const sourced = asSourced(fact, where);
  if (typeof sourced.value !== "string" || !sourced.value.trim()) throw new ImportError(`${where} is empty`);
  return sourced as Sourced<string>;
}

function factSource(fact: Sourced<unknown>, where: string): { sourceUrl: string; checkedAt: string; snippet?: string } {
  if (!fact.sourceUrl || !fact.checkedAt) throw new ImportError(`${where} is missing sourceUrl or checkedAt`);
  assertHttp(fact.sourceUrl, where);
  const checkedAt = isoDay(fact.checkedAt, where);
  const snippet = typeof fact.snippet === "string" ? fact.snippet.trim() : "";
  if (snippet.length > 400) throw new ImportError(`${where} snippet is longer than 400 characters`);
  return snippet ? { sourceUrl: fact.sourceUrl, checkedAt, snippet } : { sourceUrl: fact.sourceUrl, checkedAt };
}

function priceAmount(raw: unknown): number | null {
  if (!isRecord(raw) || !("value" in raw)) return null;
  if (typeof raw.value === "number" && Number.isFinite(raw.value)) return raw.value;
  return null;
}

function isoDay(value: string, where: string): string {
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new ImportError(`${where} has no YYYY-MM-DD date (${value})`);
  return day;
}

function assertHttp(url: string, where: string): void {
  if (!/^https?:\/\//i.test(url)) throw new ImportError(`${where} is not an http(s) URL`);
  const hits = portalMarkersIn(url);
  if (hits.length > 0) throw new ImportError(`${where} uses an aggregator domain (${hits.join(", ")})`);
}

function numOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

function isSourcedUrl(value: unknown): boolean {
  return isRecord(value) && typeof value.value === "string" && typeof value.sourceUrl === "string" && typeof value.checkedAt === "string";
}

function isSourcedDayTicket(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.value)) return false;
  return typeof value.value.eur === "number" && typeof value.sourceUrl === "string" && typeof value.checkedAt === "string";
}

function isSourcedTrue(value: unknown): boolean {
  return isRecord(value) && value.value === true && typeof value.sourceUrl === "string" && typeof value.checkedAt === "string";
}

function asPass(value: unknown, index: number): RawPass {
  const record = asRecord(value, `pass ${index}`);
  if (typeof record.id !== "string") throw new ImportError(`pass ${index} has no id`);
  return record as unknown as RawPass;
}

function asResort(value: unknown, index: number): RawResort {
  const record = asRecord(value, `resort ${index}`);
  if (typeof record.id !== "string") throw new ImportError(`resort ${index} has no id`);
  return record as unknown as RawResort;
}

function asSourced(value: unknown, where: string): Sourced<unknown> {
  if (!isRecord(value) || !("value" in value)) throw new ImportError(`${where} is not a sourced value`);
  return value as unknown as Sourced<unknown>;
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ImportError(`${where} is not an object`);
  return value;
}

function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) throw new ImportError(`${where} is not a list`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function symmetricDiff(left: string[], right: string[]): string[] {
  const a = new Set(left);
  const b = new Set(right);
  return [...left.filter((id) => !b.has(id)), ...right.filter((id) => !a.has(id))].sort();
}
