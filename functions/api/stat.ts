import { handleStatPost, type StatEnv } from "../../src/lib/stats/handler";
import type { D1Like } from "../../src/lib/db/types";

interface Env extends StatEnv {
  DB?: D1Like;
}

/** POST /api/stat — cookieless path counter (day + path only). */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) {
    return new Response(JSON.stringify({ ok: false }), { status: 503, headers: { "content-type": "application/json" } });
  }
  return handleStatPost(context.request, context.env, context.env.DB);
}
