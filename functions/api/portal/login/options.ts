import { createStores, type PortalEnv } from "../../../../src/lib/portal/auth";
import { handlePortalLoginOptions } from "../../../../src/lib/portal/handler";
import type { D1Like } from "../../../../src/lib/db/types";

interface Env extends PortalEnv {
  DB?: D1Like;
  MAP_LOAD_HASH_SALT?: string;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) return new Response(JSON.stringify({ ok: false, error: "service_unavailable" }), { status: 503 });
  const { portal, app } = createStores(context.env.DB);
  return handlePortalLoginOptions(context.request, context.env, portal, app);
}
