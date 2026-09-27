import { z } from "zod";
import type { PortalStore } from "@/lib/db/portal-store";
import { hostFromUrl } from "./invite";
import { officialWebsiteForResort } from "./resort-domains";

export const promoSubmitSchema = z.object({
  resortId: z.string().min(1),
  text: z.string().min(1).max(200),
  linkUrl: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  ownerLicenceAccepted: z.literal(true),
});

export function linkOnResortDomain(linkUrl: string | null | undefined, resortId: string): boolean {
  if (!linkUrl) return true;
  const site = officialWebsiteForResort(resortId);
  const siteHost = site ? hostFromUrl(site) : null;
  const linkHost = hostFromUrl(linkUrl);
  if (!siteHost || !linkHost) return false;
  return linkHost === siteHost || linkHost.endsWith(`.${siteHost}`);
}

export async function submitPortalPromo(
  portal: PortalStore,
  userId: string,
  body: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = promoSubmitSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "validation" };
  const resortIds = await portal.listUserResortIds(userId);
  if (!resortIds.includes(parsed.data.resortId)) return { ok: false, error: "forbidden" };
  if (!linkOnResortDomain(parsed.data.linkUrl ?? null, parsed.data.resortId)) {
    return { ok: false, error: "link_domain" };
  }
  const existing = await portal.getApprovedPromoForResort(parsed.data.resortId);
  const pending = (await portal.listPromos("pending")).find((p) => p.resort_id === parsed.data.resortId);
  if (existing || pending) return { ok: false, error: "promo_exists" };
  const id = crypto.randomUUID();
  await portal.insertPromo({
    id,
    resort_id: parsed.data.resortId,
    text: parsed.data.text,
    link_url: parsed.data.linkUrl ?? null,
    logo_url: parsed.data.logoUrl ?? null,
    owner_licence_accepted: 1,
    status: "pending",
    rejection_reason: null,
    submitted_by: userId,
    created_at: Date.now(),
    decided_at: null,
    decided_by: null,
  });
  return { ok: true, id };
}
