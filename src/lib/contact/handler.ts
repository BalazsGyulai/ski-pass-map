import { autoFlagContact, createAppStore, type AppStore } from "@/lib/db/app-store";
import { createSqlExecutor, type D1Like } from "@/lib/db/types";
import { originAllowed, parseOrigins, jsonResponse, readJsonBody } from "@/lib/http-json";
import { clientIpFromRequest } from "@/lib/client-ip";
import { hashIp, saltFromEnv } from "@/lib/ip-hash";
import { checkContactRateLimits } from "./rate-limit";
import { normalizeContactBody } from "./validation";
import { resolveTurnstileSecret, verifyTurnstile } from "./turnstile";

export interface ContactEnv {
  DB?: D1Like;
  MAP_LOAD_HASH_SALT?: string;
  MAP_LOAD_ALLOWED_ORIGINS?: string;
  TURNSTILE_SECRET_KEY?: string;
  NODE_ENV?: string;
  CONTACT_GLOBAL_DAILY_MAX?: string;
  CONTACT_HOURLY_MAX?: string;
}

export function createContactStore(db: D1Like): AppStore {
  return createAppStore(createSqlExecutor(db));
}

export async function handleContactPost(
  request: Request,
  env: ContactEnv,
  store: AppStore,
  nowMs = Date.now(),
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST" });
  }
  if (!originAllowed(request, parseOrigins(env.MAP_LOAD_ALLOWED_ORIGINS))) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }
  const turnstile = resolveTurnstileSecret(env);
  if (turnstile.mode === "missing") {
    return jsonResponse(
      { ok: false, error: "service_unavailable", message: "Contact form is temporarily unavailable. Please try again later." },
      503,
    );
  }
  const raw = await readJsonBody(request);
  if (!raw) return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  const body = normalizeContactBody(raw);
  if (!body.ok) return jsonResponse({ ok: false, error: "validation", message: body.error }, 400);
  const ip = clientIpFromRequest(request, "unknown");
  const rate = await checkContactRateLimits(store, env, ip, nowMs);
  if (!rate.allowed) {
    return jsonResponse({ ok: false, error: "rate_limited" }, 429);
  }
  const verified = await verifyTurnstile(turnstile.secret, body.data.turnstileToken, ip === "unknown" ? undefined : ip);
  if (!verified) return jsonResponse({ ok: false, error: "turnstile_failed" }, 400);
  const salt = saltFromEnv(env.MAP_LOAD_HASH_SALT, "local-dev-salt");
  const ipHash = await hashIp(salt, "contact-store", ip);
  const flag = autoFlagContact(body.data.category, body.data.resortId);
  const id = crypto.randomUUID();
  await store.insertContact({
    id,
    created_at: nowMs,
    lang: body.data.lang,
    category: body.data.category,
    resort_id: body.data.resortId ?? null,
    email: body.data.email ?? null,
    message: body.data.message,
    status: flag.status,
    flag_reason: flag.flag_reason,
    ip_hash: ipHash,
  });
  return jsonResponse({ ok: true, id });
}
