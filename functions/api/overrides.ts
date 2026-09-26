import { createSqlExecutor, type D1Like } from "../../src/lib/db/types";
import { createPortalStore } from "../../src/lib/db/portal-store";
import { handleOverridesGet } from "../../src/lib/portal/handler";

interface Env {
  DB?: D1Like;
}

/** GET /api/overrides */
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) {
    return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), fields: {}, attributions: {}, promos: [], listing: {} }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" },
    });
  }
  const portal = createPortalStore(createSqlExecutor(context.env.DB));
  return handleOverridesGet(context.request, portal);
}
