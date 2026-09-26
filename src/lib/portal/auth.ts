import { createAppStore } from "@/lib/db/app-store";
import { createPortalStore } from "@/lib/db/portal-store";
import { createSqlExecutor, type D1Like } from "@/lib/db/types";
import { jsonResponse } from "@/lib/http-json";
import { isPortalEnabled } from "./config";
import { randomToken } from "./crypto";
import {
  assertCsrf,
  clearSessionCookieHeader,
  hashSessionToken,
  parseSessionCookie,
  sessionCookieHeader,
  sessionExpiresAt,
} from "./session";

export interface PortalAuthEnv {
  NODE_ENV?: string;
  PORTAL_ENABLED?: string;
  PORTAL_DEV_BYPASS?: string;
  PORTAL_DEV_EMAIL?: string;
  PORTAL_RP_ID?: string;
  SOURCE_CHECKER_DEV_HOSTS?: string;
  SOURCE_CHECKER_DEV_FIXTURE?: string;
}

export type PortalEnv = PortalAuthEnv;

export interface PortalIdentity {
  userId: string;
  email: string;
  csrfToken: string;
  sessionId: string;
}

export function createStores(db: D1Like) {
  const sql = createSqlExecutor(db);
  return { portal: createPortalStore(sql), app: createAppStore(sql) };
}

export async function resolvePortalIdentity(
  request: Request,
  env: PortalAuthEnv,
  store: ReturnType<typeof createPortalStore>,
): Promise<PortalIdentity | null> {
  if (env.PORTAL_DEV_BYPASS === "1" && env.NODE_ENV !== "production") {
    const devEmail = request.headers.get("x-portal-dev-email") ?? env.PORTAL_DEV_EMAIL ?? "portal-dev@skimap.test";
    const user = await store.getUserByEmail(devEmail.toLowerCase());
    if (user) {
      return { userId: user.id, email: user.email, csrfToken: "dev-csrf-token", sessionId: "dev" };
    }
  }
  const cookie = parseSessionCookie(request.headers.get("cookie"));
  if (!cookie) return null;
  const session = await store.getSessionById(cookie.sessionId);
  if (!session || session.expires_at < Date.now()) return null;
  const tokenHash = await hashSessionToken(cookie.token);
  if (tokenHash !== session.token_hash) return null;
  const user = await store.getUserById(session.user_id);
  if (!user) return null;
  return { userId: user.id, email: user.email, csrfToken: session.csrf_token, sessionId: session.id };
}

export function portalDisabledResponse(env: PortalAuthEnv): Response | null {
  if (!isPortalEnabled(env)) {
    return jsonResponse({ ok: false, error: "portal_disabled" }, 404);
  }
  return null;
}

export async function requirePortalPost(
  request: Request,
  env: PortalAuthEnv,
  store: ReturnType<typeof createPortalStore>,
): Promise<{ identity: PortalIdentity } | { error: Response }> {
  const disabled = portalDisabledResponse(env);
  if (disabled) return { error: disabled };
  const identity = await resolvePortalIdentity(request, env, store);
  if (!identity) return { error: jsonResponse({ ok: false, error: "unauthorized" }, 401) };
  if (env.PORTAL_DEV_BYPASS === "1" && env.NODE_ENV !== "production" && identity.sessionId === "dev") {
    return { identity };
  }
  if (!assertCsrf(identity.csrfToken, request.headers.get("x-csrf-token"))) {
    return { error: jsonResponse({ ok: false, error: "csrf" }, 403) };
  }
  return { identity };
}

export async function createPortalSession(
  store: ReturnType<typeof createPortalStore>,
  userId: string,
  secure: boolean,
): Promise<Response> {
  const sessionId = crypto.randomUUID();
  const token = randomToken(32);
  const csrf = randomToken(16);
  const now = Date.now();
  await store.insertSession({
    id: sessionId,
    user_id: userId,
    token_hash: await hashSessionToken(token),
    csrf_token: csrf,
    created_at: now,
    expires_at: sessionExpiresAt(now),
  });
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  headers.append("set-cookie", sessionCookieHeader(sessionId, token, secure));
  return new Response(JSON.stringify({ ok: true, csrfToken: csrf }), { status: 200, headers });
}

export function logoutResponse(secure: boolean): Response {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8" });
  headers.append("set-cookie", clearSessionCookieHeader(secure));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
