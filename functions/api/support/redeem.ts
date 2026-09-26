import { createAppStore } from "../../../src/lib/db/app-store";
import { createSqlExecutor, type D1Like } from "../../../src/lib/db/types";
import { readJsonBody } from "../../../src/lib/http-json";
import { checkRedeemRate } from "../../../src/lib/support/redeem-rate";
import { redeemSupportCode } from "../../../src/lib/support/redeem";

interface Env {
  DB?: D1Like;
  SUPPORT_CODE_SALT?: string;
  MAP_LOAD_HASH_SALT?: string;
}

/** POST /api/support/redeem */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: jsonHeaders() });
  }
  if (!context.env.DB) {
    return new Response(JSON.stringify({ ok: false, error: "service_unavailable" }), { status: 503, headers: jsonHeaders() });
  }
  const store = createAppStore(createSqlExecutor(context.env.DB));
  const rate = await checkRedeemRate(store, context.request, context.env);
  if (!rate.ok) {
    return new Response(JSON.stringify({ ok: false, error: "rate_limited" }), { status: rate.status, headers: jsonHeaders() });
  }
  const body = await readJsonBody<{ code?: string }>(context.request, 512);
  if (!body) {
    return new Response(JSON.stringify({ ok: false, error: "bad_json" }), { status: 400, headers: jsonHeaders() });
  }
  const code = body.code?.trim();
  if (!code) {
    return new Response(JSON.stringify({ ok: false, error: "missing_code" }), { status: 400, headers: jsonHeaders() });
  }
  const result = await redeemSupportCode(code, context.env);
  if (!result.ok) {
    return new Response(JSON.stringify(result), { status: 400, headers: jsonHeaders() });
  }
  return new Response(JSON.stringify({ ok: true, until: result.until }), { status: 200, headers: jsonHeaders() });
}

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
}
