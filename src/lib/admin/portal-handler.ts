import { z } from "zod";
import type { AppStore } from "@/lib/db/app-store";
import type { PortalStore } from "@/lib/db/portal-store";
import { jsonResponse, readJsonBody } from "@/lib/http-json";
import { emailDomainMatchesResortSite, hashInviteToken, inviteExpiresAt, parseEmailDomain } from "@/lib/portal/invite";
import { randomToken } from "@/lib/portal/crypto";
import { officialWebsiteForResort } from "@/lib/portal/resort-domains";
import { buildExportPatch } from "./edits";
import type { AdminEnv } from "./handler";
import { verifyAdminRequest } from "./auth";
import { assertAdminPostOrigin } from "./csrf";
import { parseOrigins } from "@/lib/http-json";

async function requireAdmin(request: Request, env: AdminEnv) {
  const identity = await verifyAdminRequest(request, env);
  if (!identity) return { error: jsonResponse({ ok: false, error: "unauthorized" }, 401) as Response };
  const origins = parseOrigins(env.MAP_LOAD_ALLOWED_ORIGINS);
  if (!assertAdminPostOrigin(request, origins)) {
    return { error: jsonResponse({ ok: false, error: "forbidden" }, 403) as Response };
  }
  return { identity };
}

export async function handleAdminPortalInvites(request: Request, env: AdminEnv, app: AppStore, portal: PortalStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method === "GET") {
    const invites = await portal.listInvites(100);
    const users = await portal.listPortalUsers(100);
    return jsonResponse({ ok: true, invites, users });
  }
  if (request.method === "POST") {
    const raw = await readJsonBody(request);
    const schema = z.object({
      email: z.string().email(),
      resortIds: z.array(z.string().min(1)).min(1).max(20),
    });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
    const warnings: string[] = [];
    const domains = parsed.data.resortIds.map((id) => {
      const site = officialWebsiteForResort(id);
      const match = emailDomainMatchesResortSite(parsed.data.email, site);
      if (!match.ok) warnings.push(`domain_mismatch:${id}`);
      return match.siteDomain;
    });
    const verifiedDomain = parseEmailDomain(parsed.data.email);
    const token = randomToken(24);
    const now = Date.now();
    const id = crypto.randomUUID();
    await portal.insertInvite({
      id,
      token_hash: await hashInviteToken(token),
      email: parsed.data.email,
      resort_ids_json: JSON.stringify(parsed.data.resortIds),
      verified_domain: verifiedDomain,
      created_at: now,
      expires_at: inviteExpiresAt(now),
      used_at: null,
      used_by_user_id: null,
      created_by: auth.identity.email,
    });
    await app.insertAudit({
      id: crypto.randomUUID(),
      created_at: now,
      actor_email: auth.identity.email,
      action: "portal.invite.create",
      entity_type: "portal_invite",
      entity_id: id,
      details_json: JSON.stringify({ email: parsed.data.email, resortIds: parsed.data.resortIds, domains, warnings }),
    });
    const inviteUrl = `/portal/invite/?token=${token}`;
    return jsonResponse({ ok: true, id, inviteUrl, warnings, expiresAt: inviteExpiresAt(now) });
  }
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}

export async function handleAdminPortalRollback(request: Request, env: AdminEnv, app: AppStore, portal: PortalStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const raw = await readJsonBody(request);
  const schema = z.object({ editId: z.string().uuid(), reason: z.string().min(10).max(2000) });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
  const edit = await app.getEdit(parsed.data.editId);
  if (!edit) return jsonResponse({ ok: false, error: "not_found" }, 404);
  await portal.setEditRollback(parsed.data.editId, parsed.data.reason, auth.identity.email);
  if (edit.entity_type === "resort") {
    await portal.deleteRuntimeOverride(edit.entity_id);
  }
  await app.insertAudit({
    id: crypto.randomUUID(),
    created_at: Date.now(),
    actor_email: auth.identity.email,
    action: "portal.edit.rollback",
    entity_type: edit.entity_type,
    entity_id: edit.entity_id,
    details_json: JSON.stringify({ editId: parsed.data.editId, reason: parsed.data.reason }),
  });
  return jsonResponse({ ok: true });
}

export async function handleAdminPortalReject(request: Request, env: AdminEnv, app: AppStore, portal: PortalStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const raw = await readJsonBody(request);
  const schema = z.object({
    editId: z.string().uuid().optional(),
    promoId: z.string().uuid().optional(),
    reason: z.string().min(10).max(2000),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success || (!parsed.data.editId && !parsed.data.promoId)) {
    return jsonResponse({ ok: false, error: "validation" }, 400);
  }
  if (parsed.data.editId) {
    const edit = await app.getEdit(parsed.data.editId);
    if (!edit) return jsonResponse({ ok: false, error: "not_found" }, 404);
    await portal.setEditRejection(parsed.data.editId, parsed.data.reason, auth.identity.email);
    await app.insertAudit({
      id: crypto.randomUUID(),
      created_at: Date.now(),
      actor_email: auth.identity.email,
      action: "portal.edit.reject",
      entity_type: edit.entity_type,
      entity_id: edit.entity_id,
      details_json: JSON.stringify({ editId: parsed.data.editId, reason: parsed.data.reason }),
    });
  }
  if (parsed.data.promoId) {
    await portal.setPromoStatus(parsed.data.promoId, "rejected", auth.identity.email, parsed.data.reason);
    await app.insertAudit({
      id: crypto.randomUUID(),
      created_at: Date.now(),
      actor_email: auth.identity.email,
      action: "portal.promo.reject",
      entity_type: "promo",
      entity_id: parsed.data.promoId,
      details_json: JSON.stringify({ reason: parsed.data.reason }),
    });
  }
  return jsonResponse({ ok: true });
}

export async function handleAdminPortalApprove(request: Request, env: AdminEnv, app: AppStore, portal: PortalStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const raw = await readJsonBody(request);
  const schema = z.object({
    editId: z.string().uuid().optional(),
    promoId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success || (!parsed.data.editId && !parsed.data.promoId)) {
    return jsonResponse({ ok: false, error: "validation" }, 400);
  }
  if (parsed.data.editId) {
    const edit = await app.getEdit(parsed.data.editId);
    if (!edit) return jsonResponse({ ok: false, error: "not_found" }, 404);
    await app.setEditStatus(parsed.data.editId, "approved", auth.identity.email);
    const patch = buildExportPatch(edit);
    await app.insertAudit({
      id: crypto.randomUUID(),
      created_at: Date.now(),
      actor_email: auth.identity.email,
      action: "portal.edit.approve",
      entity_type: edit.entity_type,
      entity_id: edit.entity_id,
      details_json: JSON.stringify({ editId: parsed.data.editId }),
    });
    return jsonResponse({ ok: true, patch });
  }
  if (parsed.data.promoId) {
    await portal.setPromoStatus(parsed.data.promoId, "approved", auth.identity.email);
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: false, error: "validation" }, 400);
}

export async function handleAdminPortalQueue(request: Request, env: AdminEnv, app: AppStore, portal: PortalStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "GET") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const tierA = await portal.listEditsByTierStatus("A", "auto-published");
  const tierB = await portal.listEditsByTierStatus("B", "pending");
  const tierC = await portal.listEditsByTierStatus("C", "pending");
  const promos = await portal.listPromos("pending");
  return jsonResponse({ ok: true, postModeration: tierA, reviewB: tierB, reviewC: tierC, promos });
}

export async function handleAdminListing(request: Request, env: AdminEnv, app: AppStore, portal: PortalStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method === "GET") {
    const modes = await portal.listListingModes();
    return jsonResponse({ ok: true, listing: modes });
  }
  if (request.method === "POST") {
    const raw = await readJsonBody(request);
    const schema = z.object({ resortId: z.string().min(1), mode: z.enum(["full", "link_only", "unlisted"]) });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
    const now = Date.now();
    await portal.setListingMode(parsed.data.resortId, parsed.data.mode, now, auth.identity.email);
    await app.insertAudit({
      id: crypto.randomUUID(),
      created_at: now,
      actor_email: auth.identity.email,
      action: "resort.listing",
      entity_type: "resort",
      entity_id: parsed.data.resortId,
      details_json: JSON.stringify({ mode: parsed.data.mode }),
    });
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}
