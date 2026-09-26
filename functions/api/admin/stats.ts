import { listPageStats } from "../../../src/lib/stats/handler";
import { verifyAdminRequest, type AdminAuthEnv } from "../../../src/lib/admin/auth";
import type { D1Like } from "../../../src/lib/db/types";

interface Env extends AdminAuthEnv {
  DB?: D1Like;
  STATS_ENABLED?: string;
}

/** GET /api/admin/stats */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const identity = await verifyAdminRequest(context.request, context.env);
  if (!identity) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers: jsonHeaders() });
  }
  if (!context.env.DB) {
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers: jsonHeaders() });
  }
  const stats = await listPageStats(context.env.DB);
  const codes = await context.env.DB.prepare(
    `SELECT kofi_transaction_id, code_plain, created_at, expires_at FROM support_codes WHERE expires_at > ? ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(Date.now())
    .all();
  return new Response(
    JSON.stringify({
      ok: true,
      statsEnabled: context.env.STATS_ENABLED === "1" || context.env.STATS_ENABLED === "true",
      stats,
      supportCodes: codes.results ?? [],
    }),
    { status: 200, headers: jsonHeaders() },
  );
}

function jsonHeaders(): HeadersInit {
  return { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
}
