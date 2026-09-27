import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const httpUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Only http(s) URLs");

/**
 * A factual value plus optional provenance.
 * sourceUrl and checkedAt are set together. snippet is a short quote or paraphrase, not a copied page.
 */
export function sourced<T extends z.ZodTypeAny>(value: T) {
  return z
    .object({
      value,
      sourceUrl: httpUrl.optional(),
      checkedAt: isoDate.optional(),
      snippet: z.string().min(1).max(400).optional(),
    })
    .superRefine((fact, ctx) => {
      if ((fact.sourceUrl == null) !== (fact.checkedAt == null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sourceUrl and checkedAt must both be set or both be omitted",
        });
      }
    });
}

export const factSourceSchema = z.object({
  sourceUrl: httpUrl,
  checkedAt: isoDate,
  snippet: z.string().min(1).max(400).optional(),
});

const bracketSchema = z
  .object({
    label: z.string().min(1),
    birth_year_from: z.number().int().nullable(),
    birth_year_to: z.number().int().nullable(),
    note: z.string().min(1).optional(),
  })
  .superRefine((bracket, ctx) => {
    if (
      bracket.birth_year_from != null &&
      bracket.birth_year_to != null &&
      bracket.birth_year_from > bracket.birth_year_to
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "birth_year_from is greater than birth_year_to",
        path: ["birth_year_from"],
      });
    }
  });

const periodSchema = z.object({
  bracket: z.string().min(1),
  price_eur: z.number().nonnegative().nullable(),
  valid_until: isoDate.nullable(),
  source: factSourceSchema,
});

export const passSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  price_note: z.string().min(1),
  url: httpUrl,
  provisional: z.boolean(),
  restricted: z.boolean(),
  source: factSourceSchema,
  pricing: z.object({
    brackets: z.array(bracketSchema).min(1),
    periods: z.array(periodSchema).min(1),
  }),
});

const coverageSchema = z.object({
  id: z.string().min(1),
  sourceUrl: httpUrl,
  checkedAt: isoDate,
});

/** Non-OSM resort facts. Coordinates and OSM statistics live in data/osm.json. */
export const resortRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  verification: z.enum(["verified", "unverified"]),
  passes: z.array(coverageSchema),
  hiddenReason: z.string().min(1).nullable(),
  website: sourced(httpUrl).nullable(),
  dayTicket: sourced(
    z.object({
      eur: z.number().nonnegative(),
      season: z.string().min(1),
    }),
  ).nullable(),
  dayTicketDynamic: sourced(z.literal(true)).nullable(),
  seasonDates: sourced(z.string().min(1)).nullable(),
  publicTransport: z.string().min(1).nullable(),
  snowpark: sourced(z.literal(true)).nullable(),
  nightSkiing: sourced(z.literal(true)).nullable(),
  snowReport: sourced(httpUrl).nullable(),
  webcam: sourced(httpUrl).nullable(),
  networkPriceNote: z.string().min(1).nullable(),
  needsRecheck: z.boolean(),
  viaTourismSite: z.boolean(),
  notes: z.string().min(1).nullable(),
  listing: z.enum(["full", "link_only", "unlisted"]).optional(),
});

export const resortsFileSchema = z.object({
  generated: isoDate,
  resorts: z.array(resortRecordSchema).min(1),
});

export const passesFileSchema = z.object({
  generated: isoDate,
  passes: z.array(passSchema).min(1),
});

const trueOrNull = z.union([z.literal(true), z.null()]);

/** Europe bounds, wide enough for a later country without treating the file as worldwide. */
const europeLat = z.number().gte(34).lte(72);
const europeLon = z.number().gte(-25).lte(45);

export const osmResortSchema = z
  .object({
    id: z.string().min(1),
    lat: europeLat,
    lon: europeLon,
    coordSource: z.string().min(1),
    topElevationM: z.number().nonnegative().nullable(),
    baseElevationM: z.number().nonnegative().nullable(),
    slopeKm: z.number().nonnegative().nullable(),
    lifts: z.number().int().nonnegative().nullable(),
    snowpark: trueOrNull,
    nightSkiing: trueOrNull,
    abandoned: z.boolean(),
    /** True when piste km and lifts include nested sub-areas and must not be summed or filtered. */
    aggregate: z.boolean(),
  })
  .superRefine((resort, ctx) => {
    if (
      resort.topElevationM != null &&
      resort.baseElevationM != null &&
      resort.topElevationM < resort.baseElevationM
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "topElevationM is lower than baseElevationM",
        path: ["topElevationM"],
      });
    }
  });

export const placeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: europeLat,
  lon: europeLon,
  country: z.string().regex(/^[A-Z]{2}$/),
  coordSource: z.string().min(1),
});

export const osmFileSchema = z.object({
  licence: z.literal("ODbL-1.0"),
  attribution: z.string().min(1),
  generated: isoDate,
  places: z.array(placeSchema),
  resorts: z.array(osmResortSchema).min(1),
});

export const catalogSchema = z
  .object({
    passes: passesFileSchema,
    resorts: resortsFileSchema,
    osm: osmFileSchema,
  })
  .superRefine((data, ctx) => {
    assertUnique(data.passes.passes.map((pass) => pass.id), ["passes", "passes"], ctx);
    assertUnique(data.resorts.resorts.map((resort) => resort.id), ["resorts", "resorts"], ctx);
    assertUnique(data.osm.resorts.map((resort) => resort.id), ["osm", "resorts"], ctx);
    assertUnique(data.osm.places.map((place) => place.id), ["osm", "places"], ctx);

    const passIds = new Set(data.passes.passes.map((pass) => pass.id));
    const osmIds = new Set(data.osm.resorts.map((resort) => resort.id));
    data.passes.passes.forEach((pass, passIndex) => {
      const labels = pass.pricing.brackets.map((bracket) => bracket.label);
      assertUnique(labels, ["passes", "passes", passIndex, "pricing", "brackets"], ctx);
      const labelSet = new Set(labels);
      pass.pricing.periods.forEach((period, periodIndex) => {
        if (!labelSet.has(period.bracket)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Period refers to unknown bracket ${period.bracket}`,
            path: ["passes", "passes", passIndex, "pricing", "periods", periodIndex, "bracket"],
          });
        }
      });
      pass.pricing.brackets.forEach((bracket, bracketIndex) => {
        const periods = pass.pricing.periods.filter((period) => period.bracket === bracket.label);
        if (periods.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket ${bracket.label} has no price period`,
            path: ["passes", "passes", passIndex, "pricing", "brackets", bracketIndex],
          });
        }
        const open = periods.filter((period) => period.valid_until == null);
        if (open.length > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket ${bracket.label} has more than one open-ended period`,
            path: ["passes", "passes", passIndex, "pricing", "brackets", bracketIndex],
          });
        }
        const dates = periods.map((period) => period.valid_until).filter((date): date is string => Boolean(date));
        if (new Set(dates).size !== dates.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket ${bracket.label} repeats a valid_until date`,
            path: ["passes", "passes", passIndex, "pricing", "brackets", bracketIndex],
          });
        }
      });

      const bounded = pass.pricing.brackets.filter((bracket) => !isOpenBracket(bracket));
      for (let year = 1940; year <= 2030; year++) {
        const matched = bounded.filter((bracket) => yearInBracket(year, bracket));
        if (matched.length > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${pass.id} matches more than one birth-year bracket for ${year}`,
            path: ["passes", "passes", passIndex, "pricing", "brackets"],
          });
          break;
        }
      }
    });

    data.resorts.resorts.forEach((resort, resortIndex) => {
      if ((resort.verification === "unverified") !== Boolean(resort.hiddenReason)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Unverified resorts need a hiddenReason, and verified resorts must not have one",
          path: ["resorts", "resorts", resortIndex, "hiddenReason"],
        });
      }
      if (!osmIds.has(resort.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Resort ${resort.id} has no OpenStreetMap record`,
          path: ["resorts", "resorts", resortIndex, "id"],
        });
      }
      resort.passes.forEach((coverage, passIndex) => {
        if (!passIds.has(coverage.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown pass id ${coverage.id}`,
            path: ["resorts", "resorts", resortIndex, "passes", passIndex, "id"],
          });
        }
      });
    });

    data.osm.resorts.forEach((resort, resortIndex) => {
      if (!data.resorts.resorts.some((record) => record.id === resort.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `OpenStreetMap record ${resort.id} has no resort`,
          path: ["osm", "resorts", resortIndex, "id"],
        });
      }
    });
  });

function isOpenBracket(bracket: { birth_year_from: number | null; birth_year_to: number | null }): boolean {
  return bracket.birth_year_from == null && bracket.birth_year_to == null;
}

function yearInBracket(
  year: number,
  bracket: { birth_year_from: number | null; birth_year_to: number | null },
): boolean {
  if (bracket.birth_year_from != null && year < bracket.birth_year_from) return false;
  if (bracket.birth_year_to != null && year > bracket.birth_year_to) return false;
  return true;
}

function assertUnique(ids: string[], path: (string | number)[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate id ${id}`,
        path: [...path, index, "id"],
      });
    }
    seen.add(id);
  });
}

export type Pass = z.infer<typeof passSchema>;
export type ResortRecord = z.infer<typeof resortRecordSchema>;
export type OsmResort = z.infer<typeof osmResortSchema>;
export type Place = z.infer<typeof placeSchema>;
export type AgeBracket = Pass["pricing"]["brackets"][number];
export type PricePeriod = Pass["pricing"]["periods"][number];

/** Joined view used by the UI. Portal-only resorts are omitted by data.ts. */
export interface Resort {
  id: string;
  name: string;
  lat: number;
  lon: number;
  region: string;
  country: string;
  passes: string[];
  abandoned: boolean;
  day_ticket_eur: number | null;
  day_ticket_season: string | null;
  website: string | null;
  top_elevation_m: number | null;
  base_elevation_m: number | null;
  slope_km: number | null;
  lifts: number | null;
  snowpark: true | null;
  night_skiing: true | null;
  public_transport: string | null;
  season_dates: string | null;
  notes: string | null;
  /** Piste km used by filters and totals. Null when the area contains sub-areas. */
  slope_km_display: number | null;
  lifts_display: number | null;
  stats_aggregate: boolean;
  day_ticket_dynamic: boolean;
  day_ticket_network_note: string | null;
  needs_recheck: boolean;
  via_tourism_site: boolean;
  snow_report: string | null;
  webcam: string | null;
  provisional_passes: string[];
  sources: Partial<Record<ResortFactKey, FactRef>>;
  listing?: "full" | "link_only" | "unlisted";
}

export type ResortFactKey =
  | "dayTicket"
  | "website"
  | "season"
  | "snowpark"
  | "nightSkiing"
  | "snowReport"
  | "webcam"
  | "dynamic"
  | "slopes"
  | "lifts"
  | "elevation";

export interface FactRef {
  sourceUrl: string | null;
  checkedAt: string | null;
}

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
  country: string;
}
