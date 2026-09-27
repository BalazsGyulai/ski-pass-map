import { createAppStore } from "../../src/lib/db/app-store";
import { createSqlExecutor, type D1Like } from "../../src/lib/db/types";
import { generateSupportCode, hashSupportCode } from "../../src/lib/support/kofi-crypto";
import { checkKofiWebhookRate } from "../../src/lib/support/kofi-rate";
import { parseKofiBody } from "../../src/lib/support/kofi-parse";
import { timingSafeEqualString } from "../../src/lib/timing-safe";

interface Env {
  DB?: D1Like;
  KOFI_VERIFICATION_TOKEN?: string;
  SUPPORT_CODE_SALT?: string;
  MAP_LOAD_HASH_SALT?: string;
}

const CODE_VALID_DAYS = 30;

/** POST /api/kofi — Ko-fi webhook. Stores code hash + expiry only (no donor message, name or email). */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: jsonHeaders() });
  }
  if (!context.env.DB) {
    return new Response(JSON.stringify({ ok: false, error: "service_unavailable" }), { status: 503, headers: jsonHeaders() });
  }
  const token = context.env.KOFI_VERIFICATION_TOKEN;
  const salt = context.env.SUPPORT_CODE_SALT;
  if (!token || !salt) {
    return new Response(JSON.stringify({ ok: false, error: "not_configured" }), { status: 503, headers: jsonHeaders() });
  }

  const store = createAppStore(createSqlExecutor(context.env.DB));
  const rate = await checkKofiWebhookRate(store, context.request, context.env);
  if (!rate.ok) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), { status: rate.status, headers: jsonHeaders() });
  }

  const body = await context.request.text();
  const payload = parseKofiBody(body);
  const submitted = payload?.verification_token ?? "";
  if (!submitted || !timingSafeEqualString(submitted, token)) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: jsonHeaders() });
  }
  const txId = payload?.kofi_transaction_id ?? payload?.message_id;
  if (!txId) {
    return new Response(JSON.stringify({ ok: false, error: "bad_payload" }), { status: 400, headers: jsonHeaders() });
  }

  const now = Date.now();
  const expires = now + CODE_VALID_DAYS * 86400000;
  const code = generateSupportCode();
  const codeHash = hashSupportCode(code, salt);

  try {
    await context.env.DB.prepare(
      `INSERT INTO support_codes (kofi_transaction_id, code_hash, code_plain, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(txId, codeHash, code, now, expires)
      .run();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "duplicate" }), { status: 409, headers: jsonHeaders() });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      transactionId: txId,
      code,
      expiresAt: expires,
      note: "Copy this code from the admin Support tab and send it to the donor manually. Email is not configured.",
    }),
    { status: 200, headers: jsonHeaders() },
  );
}

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
}
