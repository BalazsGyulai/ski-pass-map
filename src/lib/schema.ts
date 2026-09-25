import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const httpUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://") || value.startsWith("http://"), "Only http(s) URLs");

const pricePeriodSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    start: isoDate.nullable(),
    end: isoDate.nullable(),
    price_eur: z.number().nonnegative().nullable(),
  })
  .superRefine((period, ctx) => {
    if (period.start && period.end && period.start > period.end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Period start is after end", path: ["start"] });
    }
  });

const ageBracketSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    min_birth_year: z.number().int().nullable(),
    max_birth_year: z.number().int().nullable(),
    periods: z.array(pricePeriodSchema).min(1),
  })
  .superRefine((bracket, ctx) => {
    if (
      bracket.min_birth_year != null &&
      bracket.max_birth_year != null &&
      bracket.min_birth_year > bracket.max_birth_year
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "min_birth_year is greater than max_birth_year",
        path: ["min_birth_year"],
      });
    }
    for (let i = 0; i < bracket.periods.length; i++) {
      for (let j = i + 1; j < bracket.periods.length; j++) {
        if (periodsOverlap(bracket.periods[i], bracket.periods[j])) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Price periods overlap: ${bracket.periods[i].id} and ${bracket.periods[j].id}`,
            path: ["periods"],
          });
        }
      }
    }
  });

const deadlineSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  kind: z.enum(["starts", "ends"]),
  label: z.string().min(1),
});

export const passSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  price_note: z.string().min(1),
  url: httpUrl,
  pricing: z.object({
    assumptions: z.string().min(1),
    brackets: z.array(ageBracketSchema).min(1),
  }),
  deadlines: z.array(deadlineSchema).default([]),
});

const optionalNonNegative = z
  .number()
  .nonnegative()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const optionalInt = z
  .number()
  .int()
  .nonnegative()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const optionalText = z
  .string()
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const optionalUrl = httpUrl
  .nullable()
  .optional()
  .transform((value) => value ?? null);
const optionalBool = z
  .boolean()
  .nullable()
  .optional()
  .transform((value) => value ?? null);

export const resortSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    lat: z.number().gte(-90).lte(90),
    lon: z.number().gte(-180).lte(180),
    region: z.string().min(1),
    passes: z.array(z.string().min(1)),
    klimaticket: z.boolean(),
    day_ticket_eur: z.number().nonnegative().nullable(),
    day_ticket_season: z.string().nullable(),
    website: httpUrl.nullable(),
    status: z.enum(["open", "closed?"]),
    top_elevation_m: optionalNonNegative,
    base_elevation_m: optionalNonNegative,
    slope_km: optionalNonNegative,
    lifts: optionalInt,
    snowpark: optionalBool,
    night_skiing: optionalBool,
    snow_report_url: optionalUrl,
    webcam_url: optionalUrl,
    public_transport_note: optionalText,
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
  });

export const citySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  note: optionalText,
});

export const datasetSchema = z
  .object({
    meta: z
      .object({
        season: z.string().optional(),
        updated: isoDate.optional(),
        age_assumptions: z.string().optional(),
        coordinate_note: z.string().optional(),
        price_disclaimer: z.string().optional(),
      })
      .optional(),
    passes: z.array(passSchema).min(1),
    cities: z.array(citySchema),
    resorts: z.array(resortSchema).min(1),
  })
  .superRefine((data, ctx) => {
    assertUnique(data.passes.map((pass) => pass.id), "passes", ctx);
    assertUnique(data.resorts.map((resort) => resort.id), "resorts", ctx);
    assertUnique(data.cities.map((city) => city.id), "cities", ctx);

    const passIds = new Set(data.passes.map((pass) => pass.id));
    const deadlineIds = new Set<string>();

    data.passes.forEach((pass, passIndex) => {
      pass.deadlines.forEach((deadline, deadlineIndex) => {
        if (deadlineIds.has(deadline.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate deadline id ${deadline.id}`,
            path: ["passes", passIndex, "deadlines", deadlineIndex, "id"],
          });
        }
        deadlineIds.add(deadline.id);
        const bound = pass.pricing.brackets.some((bracket) =>
          bracket.periods.some((period) => period.start === deadline.date || period.end === deadline.date),
        );
        if (!bound) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Deadline ${deadline.id} is not a price-period boundary`,
            path: ["passes", passIndex, "deadlines", deadlineIndex, "date"],
          });
        }
      });

      for (let year = 1940; year <= 2030; year++) {
        const matched = pass.pricing.brackets.filter((bracket) => yearInBracket(year, bracket));
        if (matched.length > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${pass.id} matches more than one age bracket for birth year ${year}`,
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

function periodsOverlap(
  a: { start: string | null; end: string | null },
  b: { start: string | null; end: string | null },
): boolean {
  const aStart = a.start ?? "0000-01-01";
  const aEnd = a.end ?? "9999-12-31";
  const bStart = b.start ?? "0000-01-01";
  const bEnd = b.end ?? "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
}

function yearInBracket(
  year: number,
  bracket: { min_birth_year: number | null; max_birth_year: number | null },
): boolean {
  if (bracket.min_birth_year != null && year < bracket.min_birth_year) return false;
  if (bracket.max_birth_year != null && year > bracket.max_birth_year) return false;
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
export type PricePeriod = AgeBracket["periods"][number];
export type Deadline = Pass["deadlines"][number];
