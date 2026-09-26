import { describe, expect, it } from "vitest";
import { createPortalStore } from "@/lib/db/portal-store";
import { createTestSqlExecutor } from "@/lib/db/test-sqlite";

describe("portal rollback", () => {
  it("marks edit rolled back and clears runtime override", async () => {
    const sql = createTestSqlExecutor();
    const portal = createPortalStore(sql);
    const editId = crypto.randomUUID();
    await portal.insertPortalEdit({
      id: editId,
      created_at: Date.now(),
      entity_type: "resort",
      entity_id: "skimap-12357",
      before_json: "{}",
      after_json: "{}",
      changes_json: "[]",
      source_url: "https://example.com",
      status: "auto-published",
      tier: "A",
      submitted_by: "user-1",
    });
    await portal.upsertRuntimeOverride("skimap-12357", '{"lifts":5}', '{"resortName":"X"}', "https://example.com", editId, Date.now());
    await portal.setEditRollback(editId, "Checker mismatch after review", "admin@test");
    await portal.deleteRuntimeOverride("skimap-12357");
    const rows = await portal.listRuntimeOverrides();
    expect(rows).toHaveLength(0);
  });
});
