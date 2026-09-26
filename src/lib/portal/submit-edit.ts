import type { FieldChange } from "@/lib/admin/edits";
import { createEditSchema } from "@/lib/admin/edits";
import type { AppStore } from "@/lib/db/app-store";
import type { PortalStore } from "@/lib/db/portal-store";
import { checkSourceForEdit, type SourceCheckerEnv } from "@/lib/source-checker";
import { buildAttributionJson } from "./attribution";
import { evaluateChangeLimits, utcDayKey, wouldExceedDailyFieldCap } from "./limits";
import { classifyPortalTier } from "./tier-fields";
import { resortNameForId } from "./resort-domains";

export interface SubmitEditInput {
  body: unknown;
  userId: string;
  userEmail: string;
  request?: Request;
}

export async function submitPortalEdit(
  input: SubmitEditInput,
  portal: PortalStore,
  app: AppStore,
  checkerEnv: SourceCheckerEnv,
): Promise<{ ok: true; editId: string; tier: string; status: string } | { ok: false; error: string }> {
  const parsed = createEditSchema.safeParse(input.body);
  if (!parsed.success) return { ok: false, error: "validation" };
  const resortIds = await portal.listUserResortIds(input.userId);
  if (!resortIds.includes(parsed.data.entityId)) return { ok: false, error: "forbidden" };

  const tier = classifyPortalTier(parsed.data.changes);
  const limits = evaluateChangeLimits(parsed.data.changes);
  let checker;
  try {
    checker = await checkSourceForEdit(parsed.data.sourceUrl, parsed.data.changes, undefined, checkerEnv, undefined, input.request);
  } catch {
    checker = null;
  }

  const day = utcDayKey();
  const current = await portal.bumpDailyFieldCount(parsed.data.entityId, day, 0);
  if (wouldExceedDailyFieldCap(current, parsed.data.changes.length)) {
    return { ok: false, error: "daily_limit" };
  }
  await portal.bumpDailyFieldCount(parsed.data.entityId, day, parsed.data.changes.length);

  const forceTierB = !limits.withinLimits || tier === "B" || tier === "C" || !checker?.autoPublishable;
  const effectiveTier = tier === "C" ? "C" : forceTierB ? "B" : "A";
  const status = effectiveTier === "A" ? "auto-published" : "pending";
  const editId = crypto.randomUUID();
  const resortName = resortNameForId(parsed.data.entityId);
  const attribution = effectiveTier === "A" ? buildAttributionJson(resortName, parsed.data.sourceUrl) : null;

  await portal.insertPortalEdit({
    id: editId,
    created_at: Date.now(),
    entity_type: parsed.data.entityType,
    entity_id: parsed.data.entityId,
    before_json: JSON.stringify(parsed.data.before),
    after_json: JSON.stringify(parsed.data.after),
    changes_json: JSON.stringify(parsed.data.changes),
    source_url: parsed.data.sourceUrl,
    checker_result_json: checker ? JSON.stringify(checker) : null,
    status,
    tier: effectiveTier,
    submitted_by: input.userId,
    attribution_json: attribution,
  });

  await app.insertAudit({
    id: crypto.randomUUID(),
    created_at: Date.now(),
    actor_email: input.userEmail,
    action: "portal.edit.submit",
    entity_type: parsed.data.entityType,
    entity_id: parsed.data.entityId,
    details_json: JSON.stringify({
      editId,
      tier: effectiveTier,
      status,
      checker: checker?.tier,
      autoPublishable: checker?.autoPublishable,
      limits,
    }),
  });

  if (effectiveTier === "A" && attribution) {
    const fields = changesToRuntimeFields(parsed.data.changes);
    await portal.upsertRuntimeOverride(
      parsed.data.entityId,
      JSON.stringify(fields),
      attribution,
      parsed.data.sourceUrl,
      editId,
      Date.now(),
    );
  }

  return { ok: true, editId, tier: effectiveTier, status };
}

function changesToRuntimeFields(changes: FieldChange[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const c of changes) {
    const leaf = c.path.split(".").pop() ?? c.path;
    if (leaf === "seasonDates" || leaf === "season") fields.season_dates = c.after;
    else if (leaf === "snowReport") fields.snow_report = c.after;
    else if (leaf === "website") fields.website = c.after;
    else if (leaf === "lifts") fields.lifts = c.after;
    else if (leaf === "slopeKm" || leaf === "slopes") fields.slope_km = c.after;
    else fields[leaf] = c.after;
  }
  return fields;
}
