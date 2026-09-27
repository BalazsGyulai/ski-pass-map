import { createStores, type PortalEnv } from "../../../../src/lib/portal/auth";
import { handlePortalRegisterVerify } from "../../../../src/lib/portal/handler";
import type { D1Like } from "../../../../src/lib/db/types";

interface Env extends PortalEnv {
  DB?: D1Like;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) return new Response(JSON.stringify({ ok: false, error: "service_unavailable" }), { status: 503 });
  const { portal } = createStores(context.env.DB);
  return handlePortalRegisterVerify(context.request, context.env, portal);
}
