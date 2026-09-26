import { z } from "zod";
import { LANGS } from "@/i18n/languages";

export const CONTACT_CATEGORIES = ["general", "data-error", "resort-owner", "privacy", "other"] as const;

export const contactBodySchema = z.object({
  lang: z.enum(LANGS),
  category: z.enum(CONTACT_CATEGORIES),
  resortId: z.string().max(80).optional().nullable(),
  email: z.union([z.literal(""), z.string().email().max(254)]).optional().nullable(),
  message: z.string().trim().min(10).max(4000),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Privacy note must be accepted" }) }),
  turnstileToken: z.string().min(1).max(2048),
});

export type ContactBody = z.infer<typeof contactBodySchema>;

export function normalizeContactBody(raw: unknown): { ok: true; data: ContactBody } | { ok: false; error: string } {
  const parsed = contactBodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid request";
    return { ok: false, error: first };
  }
  const data = parsed.data;
  const resortId = data.resortId?.trim() || null;
  const email = data.email?.trim() || null;
  return {
    ok: true,
    data: {
      ...data,
      resortId,
      email: email === "" ? null : email,
    },
  };
}
