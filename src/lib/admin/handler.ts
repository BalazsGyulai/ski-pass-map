import { createAppStore, type AppStore } from "@/lib/db/app-store";
import { createSqlExecutor, type D1Like } from "@/lib/db/types";
import { jsonResponse, parseOrigins, readJsonBody } from "@/lib/http-json";
import { verifyAdminRequest, type AdminAuthEnv } from "./auth";
import { assertAdminPostOrigin } from "./csrf";
import { buildExportPatch, createEditSchema, classifyTier } from "./edits";
import { checkSourceForEdit } from "@/lib/source-checker";
import type { ContactStatus, EditStatus } from "@/lib/db/types";
import { z } from "zod";

export interface AdminEnv extends AdminAuthEnv {
  DB?: D1Like;
  MAP_LOAD_ALLOWED_ORIGINS?: string;
  AI?: { run(model: string, input: { prompt: string }): Promise<unknown> };
  SOURCE_CHECKER_DEV_HOSTS?: string;
  SOURCE_CHECKER_DEV_FIXTURE?: string;
  NODE_ENV?: string;
}

export function createAdminStore(db: D1Like): AppStore {
  return createAppStore(createSqlExecutor(db));
}

async function requireAdmin(request: Request, env: AdminEnv) {
  const identity = await verifyAdminRequest(request, env);
  if (!identity) return { error: jsonResponse({ ok: false, error: "unauthorized" }, 401) as Response };
  const origins = parseOrigins(env.MAP_LOAD_ALLOWED_ORIGINS);
  if (!assertAdminPostOrigin(request, origins)) {
    return { error: jsonResponse({ ok: false, error: "forbidden" }, 403) as Response };
  }
  return { identity };
}

export async function handleAdminMessages(request: Request, env: AdminEnv, store: AppStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method === "GET") {
    const status = new URL(request.url).searchParams.get("status") as ContactStatus | null;
    const rows = await store.listContacts(status ? { status } : undefined);
    return jsonResponse({ ok: true, messages: rows });
  }
  if (request.method === "PATCH") {
    const raw = await readJsonBody(request);
    const schema = z.object({ id: z.string().uuid(), status: z.enum(["new", "flagged", "done", "spam"]) });
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
    const ok = await store.updateContactStatus(parsed.data.id, parsed.data.status);
    if (!ok) return jsonResponse({ ok: false, error: "not_found" }, 404);
    await store.insertAudit({
      id: crypto.randomUUID(),
      created_at: Date.now(),
      actor_email: auth.identity.email,
      action: "contact.status",
      entity_type: "contact",
      entity_id: parsed.data.id,
      details_json: JSON.stringify({ status: parsed.data.status }),
    });
    return jsonResponse({ ok: true });
  }
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}

export async function handleAdminEdits(request: Request, env: AdminEnv, store: AppStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method === "GET") {
    const status = new URL(request.url).searchParams.get("status") as EditStatus | null;
    const rows = await store.listEdits(status ?? undefined);
    return jsonResponse({ ok: true, edits: rows });
  }
  if (request.method === "POST") {
    const raw = await readJsonBody(request);
    const parsed = createEditSchema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
    const tier = classifyTier(parsed.data.changes);
    const id = crypto.randomUUID();
    await store.insertEdit({
      id,
      created_at: Date.now(),
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      before_json: JSON.stringify(parsed.data.before),
      after_json: JSON.stringify(parsed.data.after),
      changes_json: JSON.stringify(parsed.data.changes),
      source_url: parsed.data.sourceUrl,
      status: "pending",
      tier,
    });
    await store.insertAudit({
      id: crypto.randomUUID(),
      created_at: Date.now(),
      actor_email: auth.identity.email,
      action: "edit.create",
      entity_type: parsed.data.entityType,
      entity_id: parsed.data.entityId,
      details_json: JSON.stringify({ editId: id, tier }),
    });
    return jsonResponse({ ok: true, id, tier });
  }
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
}

export async function handleAdminEditAction(
  request: Request,
  env: AdminEnv,
  store: AppStore,
  editId: string,
  action: "approve" | "reject",
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const edit = await store.getEdit(editId);
  if (!edit) return jsonResponse({ ok: false, error: "not_found" }, 404);
  const status: EditStatus = action === "approve" ? "approved" : "rejected";
  await store.setEditStatus(editId, status, auth.identity.email);
  await store.insertAudit({
    id: crypto.randomUUID(),
    created_at: Date.now(),
    actor_email: auth.identity.email,
    action: `edit.${action}`,
    entity_type: edit.entity_type,
    entity_id: edit.entity_id,
    details_json: JSON.stringify({ editId }),
  });
  const patch = action === "approve" ? buildExportPatch(edit) : null;
  return jsonResponse({ ok: true, patch });
}

export async function handleAdminCheck(request: Request, env: AdminEnv, store: AppStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const raw = await readJsonBody(request);
  const schema = z.object({
    sourceUrl: z.string().url(),
    changes: createEditSchema.shape.changes,
    editId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return jsonResponse({ ok: false, error: "validation" }, 400);
  try {
    const result = await checkSourceForEdit(parsed.data.sourceUrl, parsed.data.changes, env.AI, env);
    const checkerJson = JSON.stringify(result);
    if (parsed.data.editId) {
      await store.setEditStatus(parsed.data.editId, result.autoPublishable ? "auto-published" : "pending", auth.identity.email, checkerJson);
    }
    return jsonResponse({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "check_failed";
    return jsonResponse({ ok: false, error: message }, 400);
  }
}

export async function handleAdminAudit(request: Request, env: AdminEnv, store: AppStore): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ("error" in auth && auth.error) return auth.error;
  if (request.method !== "GET") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  const rows = await store.listAudit(200);
  return jsonResponse({ ok: true, audit: rows });
}
