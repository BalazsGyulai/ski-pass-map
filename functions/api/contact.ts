import { createContactStore, handleContactPost, type ContactEnv } from "../../src/lib/contact/handler";
import type { D1Like } from "../../src/lib/db/types";

interface Env extends ContactEnv {
  DB?: D1Like;
}

/** POST /api/contact */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) {
    return new Response(
      JSON.stringify({ ok: false, error: "service_unavailable", message: "Database is not configured." }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
    );
  }
  return handleContactPost(context.request, context.env, createContactStore(context.env.DB));
}
