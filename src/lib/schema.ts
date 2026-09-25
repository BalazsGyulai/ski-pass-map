import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const httpUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Only http(s) URLs");

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
});

export const passSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  price_note: z.string().min(1),
  url: httpUrl,
  pricing: z.object({
    brackets: z.array(bracketSchema).min(1),
    periods: z.array(periodSchema).min(1),
  }),
});

const optionalUrl = httpUrl.nullable();
const trueOrUnknown = z.union([z.literal(true), z.null()]);

export const resortSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    lat: z.number().gte(45.7).lte(49.1),
    lon: z.number().gte(9.5).lte(22.9),
    region: z.string().min(1),
    passes: z.array(z.string().min(1)),
    klimaticket: z.boolean(),
    day_ticket_eur: z.number().nonnegative().nullable(),
    day_ticket_season: z.string().min(1).nullable(),
    website: optionalUrl,
    status: z.enum(["open", "closed?"]),
    coord_source: z.string().min(1),
    top_elevation_m: z.number().nonnegative().nullable(),
    base_elevation_m: z.number().nonnegative().nullable(),
    slope_km: z.number().nonnegative().nullable(),
    lifts: z.number().int().nonnegative().nullable(),
    stats_source: z.string().min(1).nullable(),
    snowpark: trueOrUnknown,
    night_skiing: trueOrUnknown,
    snow_report_url: optionalUrl,
    webcam_url: optionalUrl,
    public_transport_note: z.string().nullable(),
    season_dates_2026_27: z.string().nullable(),
    listed_on: z.array(z.string().min(1)),
    skiresort_url: optionalUrl,
    bergfex_url: optionalUrl,
    piste_map_url: optionalUrl.optional(),
    notes: z.string().nullable(),
    feature_evidence: z.string().nullable(),
  })
  .superRefine((resort, ctx) => {
    if (
      resort.top_elevation_m != null &&
      resort.base_elevation_m != null &&
      resort.top_elevation_m < resort.base_elevation_m
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "top_elevation_m is lower than base_elevation_m",
        path: ["top_elevation_m"],
      });
    }
    if ((resort.day_ticket_eur == null) !== (resort.day_ticket_season == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "day_ticket_eur and day_ticket_season must both be set or both be null",
        path: ["day_ticket_season"],
      });
    }
  });

export const citySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  country: z.string().min(1),
});

export const datasetSchema = z
  .object({
    generated: isoDate,
    passes: z.array(passSchema).min(1),
    cities: z.array(citySchema),
    resorts: z.array(resortSchema).min(1),
  })
  .superRefine((data, ctx) => {
    assertUnique(data.passes.map((pass) => pass.id), "passes", ctx);
    assertUnique(data.resorts.map((resort) => resort.id), "resorts", ctx);
    assertUnique(data.cities.map((city) => city.id), "cities", ctx);

    const passIds = new Set(data.passes.map((pass) => pass.id));
    data.passes.forEach((pass, passIndex) => {
      const labels = pass.pricing.brackets.map((bracket) => bracket.label);
      assertUnique(labels, `passes.${passIndex}.brackets`, ctx);
      const labelSet = new Set(labels);
      pass.pricing.periods.forEach((period, periodIndex) => {
        if (!labelSet.has(period.bracket)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Period refers to unknown bracket ${period.bracket}`,
            path: ["passes", passIndex, "pricing", "periods", periodIndex, "bracket"],
          });
        }
      });
      pass.pricing.brackets.forEach((bracket, bracketIndex) => {
        const periods = pass.pricing.periods.filter((period) => period.bracket === bracket.label);
        if (periods.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket ${bracket.label} has no price period`,
            path: ["passes", passIndex, "pricing", "brackets", bracketIndex],
          });
        }
        const open = periods.filter((period) => period.valid_until == null);
        if (open.length > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket ${bracket.label} has more than one open-ended period`,
            path: ["passes", passIndex, "pricing", "brackets", bracketIndex],
          });
        }
        const dates = periods.map((period) => period.valid_until).filter((date): date is string => Boolean(date));
        if (new Set(dates).size !== dates.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Bracket ${bracket.label} repeats a valid_until date`,
            path: ["passes", passIndex, "pricing", "brackets", bracketIndex],
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
            path: ["passes", passIndex, "pricing", "brackets"],
          });
          break;
        }
      }
    });

    data.resorts.forEach((resort, resortIndex) => {
      resort.passes.forEach((passId, passIndex) => {
        if (!passIds.has(passId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown pass id ${passId}`,
            path: ["resorts", resortIndex, "passes", passIndex],
          });
        }
      });
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

function assertUnique(ids: string[], label: string, ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate ${label} id ${id}`,
        path: [label, index, "id"],
      });
    }
    seen.add(id);
  });
}

export type Dataset = z.infer<typeof datasetSchema>;
export type Pass = Dataset["passes"][number];
export type Resort = Dataset["resorts"][number];
export type City = Dataset["cities"][number];
export type AgeBracket = Pass["pricing"]["brackets"][number];
export type PricePeriod = Pass["pricing"]["periods"][number];
