import { createAdminStore, handleAdminMessages, type AdminEnv } from "../../../src/lib/admin/handler";
import type { D1Like } from "../../../src/lib/db/types";

interface Env extends AdminEnv {
  DB?: D1Like;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) {
    return new Response(JSON.stringify({ ok: false, error: "service_unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  return handleAdminMessages(context.request, context.env, createAdminStore(context.env.DB));
}
