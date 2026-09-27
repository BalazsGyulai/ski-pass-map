import { z } from "zod";
import type { EditTier, EntityType } from "@/lib/db/types";

const httpUrl = z.string().url().refine((v) => v.startsWith("http://") || v.startsWith("https://"));

export const fieldChangeSchema = z.object({
  path: z.string().min(1).max(200),
  before: z.unknown(),
  after: z.unknown(),
  kind: z.enum(["price", "date", "url", "text", "lift", "pass", "number", "other"]),
});

export const createEditSchema = z.object({
  entityType: z.enum(["resort", "pass"]),
  entityId: z.string().min(1).max(80),
  sourceUrl: httpUrl,
  changes: z.array(fieldChangeSchema).min(1).max(40),
  before: z.record(z.unknown()),
  after: z.record(z.unknown()),
});

export type FieldChange = z.infer<typeof fieldChangeSchema>;

const TIER_A_PATHS = /^(coordinates|lat|lon|lifts|elevation|website|season|officialUrl|url)$/i;
const TIER_C_PATHS = /(promo|image|banner|marketing)/i;

export function classifyTier(changes: FieldChange[]): EditTier {
  if (changes.some((c) => TIER_C_PATHS.test(c.path))) return "C";
  if (changes.every((c) => TIER_A_PATHS.test(c.path.split(".").pop() ?? c.path) || c.kind === "number" || c.kind === "date" || c.kind === "url")) {
    return "A";
  }
  if (changes.some((c) => c.kind === "price" || c.kind === "text")) return "B";
  return "B";
}

export interface DataPatchFile {
  version: 1;
  generatedAt: string;
  targetFile: "data/resorts.json" | "data/passes.json";
  entityType: EntityType;
  entityId: string;
  sourceUrl: string;
  changes: FieldChange[];
  after: Record<string, unknown>;
}

export function buildExportPatch(edit: {
  entity_type: EntityType;
  entity_id: string;
  source_url: string;
  changes_json: string;
  after_json: string;
}): DataPatchFile {
  const changes = JSON.parse(edit.changes_json) as FieldChange[];
  const after = JSON.parse(edit.after_json) as Record<string, unknown>;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    targetFile: edit.entity_type === "resort" ? "data/resorts.json" : "data/passes.json",
    entityType: edit.entity_type,
    entityId: edit.entity_id,
    sourceUrl: edit.source_url,
    changes,
    after,
  };
}

function setDeep(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (typeof next !== "object" || next == null) cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

export function applyPatchToCatalog(
  catalog: { resorts?: unknown[]; passes?: unknown[] },
  patch: DataPatchFile,
): { resorts?: unknown[]; passes?: unknown[] } {
  const list = patch.targetFile === "data/resorts.json" ? (catalog.resorts ?? []) : (catalog.passes ?? []);
  const idx = (list as Array<{ id: string }>).findIndex((row) => row.id === patch.entityId);
  if (idx < 0) throw new Error(`Entity ${patch.entityId} not found`);
  const clone = JSON.parse(JSON.stringify(list[idx])) as Record<string, unknown>;
  for (const change of patch.changes) {
    setDeep(clone, change.path, change.after);
  }
  const next = [...list];
  next[idx] = clone;
  if (patch.targetFile === "data/resorts.json") return { resorts: next };
  return { passes: next };
}
