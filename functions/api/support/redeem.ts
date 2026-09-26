import { redeemSupportCode } from "../../../src/lib/support/redeem";
import type { D1Like } from "../../../src/lib/db/types";

interface Env {
  DB?: D1Like;
  SUPPORT_CODE_SALT?: string;
}

/** POST /api/support/redeem */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (context.request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false }), { status: 405, headers: jsonHeaders() });
  }
  let body: { code?: string };
  try {
    body = (await context.request.json()) as { code?: string };
  } catch {
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
