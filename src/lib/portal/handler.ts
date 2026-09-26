import { z } from "zod";
import type { AppStore } from "@/lib/db/app-store";
import type { PortalStore } from "@/lib/db/portal-store";
import { jsonResponse, readJsonBody } from "@/lib/http-json";
import { readPortalConfig } from "./config";
import {
  createPortalSession,
  logoutResponse,
  portalDisabledResponse,
  requirePortalPost,
  resolvePortalIdentity,
  type PortalAuthEnv,
} from "./auth";
import { hashInviteToken, isInviteExpired } from "./invite";
import { submitPortalEdit } from "./submit-edit";
import {
  createAuthenticationOptions,
  createRegistrationOptions,
  verifyAuthentication,
  verifyRegistration,
  webAuthnConfigFromRequest,
} from "./webauthn";
import { checkPortalLoginRate } from "./login-rate";
import { resortPortalSnapshot } from "./resort-edit-fields";
import { submitPortalPromo } from "./promo-submit";
import { resortNameForId } from "./resort-domains";
import { buildOverridesPayload } from "./overrides-api";
import type { SourceCheckerEnv } from "@/lib/source-checker";

export type PortalEnv = PortalAuthEnv & SourceCheckerEnv;

function bytesToB64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function handleOverridesGet(_request: Request, portal: PortalStore): Promise<Response> {
  const payload = await buildOverridesPayload(portal);
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
    },
  });
}

export async function handlePortalMe(request: Request, env: PortalEnv, portal: PortalStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  const identity = await resolvePortalIdentity(request, env, portal);
  if (!identity) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const resorts = await portal.listUserResortIds(identity.userId);
  const config = readPortalConfig();
  return jsonResponse({ ok: true, email: identity.email, resorts, termsVersion: config.termsVersion, csrfToken: identity.csrfToken });
}

export async function handlePortalInviteGet(token: string, env: PortalEnv, portal: PortalStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  const hash = await hashInviteToken(token);
  const invite = await portal.getInviteByTokenHash(hash);
  if (!invite || invite.used_at != null || isInviteExpired(invite.expires_at)) {
    return jsonResponse({ ok: false, error: "invalid_invite" }, 404);
  }
  const resortIds = JSON.parse(invite.resort_ids_json) as string[];
  const config = readPortalConfig();
  return jsonResponse({
    ok: true,
    email: invite.email,
    resortIds,
    termsVersion: config.termsVersion,
    verifiedDomain: invite.verified_domain,
  });
}

export async function handlePortalRegisterOptions(request: Request, env: PortalEnv, portal: PortalStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const raw = await readJsonBody(request);
  const schema = z.object({
    inviteToken: z.string().min(20),
    termsVersion: z.string().min(1),
    termsAccepted: z.literal(true),
    liabilityAccepted: z.literal(true),
    displayName: z.string().min(1).max(120).optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
  const config = readPortalConfig();
  if (parsed.data.termsVersion !== config.termsVersion) return jsonResponse({ ok: false, error: "terms_version" }, 400);

  const hash = await hashInviteToken(parsed.data.inviteToken);
  const invite = await portal.getInviteByTokenHash(hash);
  if (!invite || invite.used_at != null || isInviteExpired(invite.expires_at)) {
    return jsonResponse({ ok: false, error: "invalid_invite" }, 404);
  }

  const emailLower = invite.email.toLowerCase();
  const existing = await portal.getUserByEmail(emailLower);
  if (existing) return jsonResponse({ ok: false, error: "already_registered" }, 409);

  const userId = crypto.randomUUID();
  const wconfig = webAuthnConfigFromRequest(request, env);
  const options = await createRegistrationOptions(wconfig, userId, invite.email, []);
  const challengeId = crypto.randomUUID();
  await portal.insertChallenge({
    id: challengeId,
    challenge: options.challenge,
    user_id: null,
    email_lower: emailLower,
    invite_id: invite.id,
    expires_at: Date.now() + 5 * 60 * 1000,
  });

  return jsonResponse({
    ok: true,
    challengeId,
    options,
    pendingUserId: userId,
    displayName: parsed.data.displayName ?? null,
    termsVersion: parsed.data.termsVersion,
  });
}

export async function handlePortalRegisterVerify(request: Request, env: PortalEnv, portal: PortalStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const raw = await readJsonBody(request);
  const schema = z.object({
    challengeId: z.string().uuid(),
    pendingUserId: z.string().uuid(),
    response: z.unknown(),
    displayName: z.string().min(1).max(120).optional(),
    termsVersion: z.string().min(1),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);

  const challengeRow = await portal.getChallenge(parsed.data.challengeId);
  if (!challengeRow || challengeRow.expires_at < Date.now() || !challengeRow.invite_id) {
    return jsonResponse({ ok: false, error: "challenge_expired" }, 400);
  }
  const invite = await portal.getInviteById(challengeRow.invite_id);
  if (!invite || invite.used_at != null || isInviteExpired(invite.expires_at)) {
    return jsonResponse({ ok: false, error: "invalid_invite" }, 404);
  }

  const wconfig = webAuthnConfigFromRequest(request, env);
  const verification = await verifyRegistration(wconfig, challengeRow.challenge, parsed.data.response);
  if (!verification.verified || !verification.registrationInfo) {
    return jsonResponse({ ok: false, error: "webauthn_failed" }, 400);
  }

  const now = Date.now();
  const userId = parsed.data.pendingUserId;
  const emailLower = invite.email.toLowerCase();
  await portal.insertUser({
    id: userId,
    email: invite.email,
    email_lower: emailLower,
    display_name: parsed.data.displayName ?? null,
    terms_version: parsed.data.termsVersion,
    terms_accepted_at: now,
    webauthn_user_id: userId,
    totp_secret: null,
    totp_enabled: 0,
    created_at: now,
  });
  const { credential, credentialDeviceType } = verification.registrationInfo;
  const credId = credential.id;
  const pubKey = bytesToB64url(new Uint8Array(credential.publicKey));
  await portal.insertCredential({
    id: crypto.randomUUID(),
    user_id: userId,
    credential_id: credId,
    public_key: pubKey,
    counter: credential.counter,
    transports: credentialDeviceType,
    created_at: now,
  });
  const resortIds = JSON.parse(invite.resort_ids_json) as string[];
  await portal.setUserResorts(userId, resortIds);
  await portal.markInviteUsed(invite.id, userId, now);
  await portal.deleteChallenge(parsed.data.challengeId);
  const secure = new URL(request.url).protocol === "https:";
  return createPortalSession(portal, userId, secure);
}

export async function handlePortalLoginOptions(
  request: Request,
  env: PortalEnv,
  portal: PortalStore,
  app: AppStore,
): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const rate = await checkPortalLoginRate(app, request, env);
  if (!rate.ok) return jsonResponse({ ok: false, error: "rate_limit" }, rate.status);
  const raw = await readJsonBody(request);
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
  const user = await portal.getUserByEmail(parsed.data.email.toLowerCase());
  if (!user) return jsonResponse({ ok: false, error: "unknown_user" }, 404);
  const creds = await portal.listCredentialsByUserId(user.id);
  if (creds.length === 0) return jsonResponse({ ok: false, error: "no_credentials" }, 400);
  const wconfig = webAuthnConfigFromRequest(request, env);
  const options = await createAuthenticationOptions(wconfig, creds.map((c) => c.credential_id));
  const challengeId = crypto.randomUUID();
  await portal.insertChallenge({
    id: challengeId,
    challenge: options.challenge,
    user_id: user.id,
    email_lower: user.email_lower,
    invite_id: null,
    expires_at: Date.now() + 5 * 60 * 1000,
  });
  return jsonResponse({ ok: true, challengeId, options });
}

export async function handlePortalLoginVerify(request: Request, env: PortalEnv, portal: PortalStore, app: AppStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const rate = await checkPortalLoginRate(app, request, env);
  if (!rate.ok) return jsonResponse({ ok: false, error: "rate_limit" }, rate.status);
  const raw = await readJsonBody(request);
  const schema = z.object({ challengeId: z.string().uuid(), response: z.unknown() });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
  const challengeRow = await portal.getChallenge(parsed.data.challengeId);
  if (!challengeRow || challengeRow.expires_at < Date.now() || !challengeRow.user_id) {
    return jsonResponse({ ok: false, error: "challenge_expired" }, 400);
  }
  const credId = (parsed.data.response as { id?: string })?.id;
  if (!credId) return jsonResponse({ ok: false, error: "webauthn_failed" }, 400);
  const cred = await portal.getCredentialById(credId);
  if (!cred || cred.user_id !== challengeRow.user_id) return jsonResponse({ ok: false, error: "webauthn_failed" }, 400);
  const wconfig = webAuthnConfigFromRequest(request, env);
  const verification = await verifyAuthentication(wconfig, challengeRow.challenge, parsed.data.response, {
    id: cred.credential_id,
    publicKey: cred.public_key,
    counter: cred.counter,
  });
  if (!verification.verified) return jsonResponse({ ok: false, error: "webauthn_failed" }, 401);
  if (verification.authenticationInfo) {
    await portal.updateCredentialCounter(cred.id, verification.authenticationInfo.newCounter);
  }
  await portal.deleteChallenge(parsed.data.challengeId);
  const secure = new URL(request.url).protocol === "https:";
  return createPortalSession(portal, challengeRow.user_id, secure);
}

export async function handlePortalResorts(request: Request, env: PortalEnv, portal: PortalStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  const identity = await resolvePortalIdentity(request, env, portal);
  if (!identity) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  const ids = await portal.listUserResortIds(identity.userId);
  const resorts = ids
    .map((id) => resortPortalSnapshot(id))
    .filter((r): r is NonNullable<typeof r> => r != null);
  return jsonResponse({ ok: true, resorts });
}

export async function handlePortalPromo(request: Request, env: PortalEnv, portal: PortalStore, app: AppStore): Promise<Response> {
  if (request.method === "GET") {
    const disabled = portalDisabledResponse(env);
    if (disabled) return disabled;
    const identity = await resolvePortalIdentity(request, env, portal);
    if (!identity) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    const resortId = new URL(request.url).searchParams.get("resortId");
    if (!resortId) return jsonResponse({ ok: false, error: "validation" }, 400);
    const resortIds = await portal.listUserResortIds(identity.userId);
    if (!resortIds.includes(resortId)) return jsonResponse({ ok: false, error: "forbidden" }, 403);
    const approved = await portal.getApprovedPromoForResort(resortId);
    const pending = (await portal.listPromos("pending")).find((p) => p.resort_id === resortId);
    const rejected = (await portal.listPromos("rejected")).find((p) => p.resort_id === resortId);
    return jsonResponse({ ok: true, promo: approved ?? pending ?? rejected ?? null, resortName: resortNameForId(resortId) });
  }
  const auth = await requirePortalPost(request, env, portal);
  if ("error" in auth) return auth.error;
  const result = await submitPortalPromo(portal, auth.identity.userId, await readJsonBody(request));
  if (!result.ok) return jsonResponse({ ok: false, error: result.error }, 400);
  await app.insertAudit({
    id: crypto.randomUUID(),
    created_at: Date.now(),
    actor_email: auth.identity.email,
    action: "portal.promo.submit",
    entity_type: "promo",
    entity_id: result.id,
    details_json: null,
  });
  return jsonResponse(result);
}

function formatSubmissionRows(edits: Array<Record<string, unknown>>) {
  return edits.map((edit) => {
    const changes = JSON.parse(String(edit.changes_json)) as Array<{ path: string; before: unknown; after: unknown }>;
    const reason = edit.rejection_reason ?? edit.rollback_reason ?? null;
    return {
      id: edit.id,
      createdAt: edit.created_at,
      resortId: edit.entity_id,
      resortName: resortNameForId(String(edit.entity_id)),
      status: edit.status,
      tier: edit.tier,
      sourceUrl: edit.source_url,
      reason,
      fields: changes.map((c) => ({
        path: c.path,
        before: c.before,
        after: c.after,
      })),
    };
  });
}

export async function handlePortalEdits(request: Request, env: PortalEnv, portal: PortalStore, app: AppStore): Promise<Response> {
  if (request.method === "GET") {
    const disabled = portalDisabledResponse(env);
    if (disabled) return disabled;
    const identity = await resolvePortalIdentity(request, env, portal);
    if (!identity) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    const resortIds = new Set(await portal.listUserResortIds(identity.userId));
    const allStatuses = ["pending", "auto-published", "approved", "rejected"] as const;
    const edits = [];
    for (const status of allStatuses) {
      for (const tier of ["A", "B", "C"] as const) {
        const rows = await portal.listEditsByTierStatus(tier, status);
        edits.push(...rows.filter((e) => resortIds.has(e.entity_id)));
      }
    }
    return jsonResponse({ ok: true, submissions: formatSubmissionRows(edits as unknown as Array<Record<string, unknown>>) });
  }
  const auth = await requirePortalPost(request, env, portal);
  if ("error" in auth) return auth.error;
  const result = await submitPortalEdit(
    { body: await readJsonBody(request), userId: auth.identity.userId, userEmail: auth.identity.email },
    portal,
    app,
    env,
  );
  if (!result.ok) return jsonResponse({ ok: false, error: result.error }, 400);
  return jsonResponse(result);
}

export async function handlePortalLogout(request: Request, env: PortalEnv, portal: PortalStore): Promise<Response> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return disabled;
  const identity = await resolvePortalIdentity(request, env, portal);
  if (identity?.sessionId && identity.sessionId !== "dev") {
    await portal.deleteSession(identity.sessionId);
  }
  const secure = new URL(request.url).protocol === "https:";
  return logoutResponse(secure);
}

export async function handlePortalDevLogin(request: Request, env: PortalEnv, portal: PortalStore): Promise<Response> {
  if (env.NODE_ENV === "production" || env.PORTAL_DEV_BYPASS !== "1") {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }
  const email = (request.headers.get("x-portal-dev-email") ?? env.PORTAL_DEV_EMAIL ?? "portal-dev@skimap.test").toLowerCase();
  let user = await portal.getUserByEmail(email);
  if (!user) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const config = readPortalConfig();
    await portal.insertUser({
      id,
      email,
      email_lower: email,
      display_name: "Dev portal user",
      terms_version: config.termsVersion,
      terms_accepted_at: now,
      webauthn_user_id: id,
      totp_secret: null,
      totp_enabled: 0,
      created_at: now,
    });
    await portal.setUserResorts(id, ["skimap-12357"]);
    user = await portal.getUserByEmail(email);
  }
  if (!user) return jsonResponse({ ok: false, error: "setup_failed" }, 500);
  const secure = new URL(request.url).protocol === "https:";
  return createPortalSession(portal, user.id, secure);
}
