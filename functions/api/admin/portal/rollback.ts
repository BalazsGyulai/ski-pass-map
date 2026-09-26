import { createAdminStore, type AdminEnv } from "../../../../src/lib/admin/handler";
import { handleAdminPortalRollback } from "../../../../src/lib/admin/portal-handler";
import { createPortalStore } from "../../../../src/lib/db/portal-store";
import { createSqlExecutor, type D1Like } from "../../../../src/lib/db/types";

interface Env extends AdminEnv {
  DB?: D1Like;
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  if (!context.env.DB) return new Response(JSON.stringify({ ok: false, error: "service_unavailable" }), { status: 503 });
  const sql = createSqlExecutor(context.env.DB);
  return handleAdminPortalRollback(context.request, context.env, createAdminStore(context.env.DB), createPortalStore(sql));
}
