import { describe, expect, it } from "vitest";
import { autoFlagContact, createAppStore } from "./app-store";
import { createTestSqlExecutor } from "./test-sqlite";

describe("app store", () => {
  it("flags data-error and resort id messages", async () => {
    expect(autoFlagContact("data-error", null).status).toBe("flagged");
    expect(autoFlagContact("general", "skimap-1").status).toBe("flagged");
    const store = createAppStore(createTestSqlExecutor());
    await store.insertContact({
      id: crypto.randomUUID(),
      created_at: Date.now(),
      lang: "en",
      category: "general",
      resort_id: null,
      email: null,
      message: "hello world message",
      status: "new",
      flag_reason: null,
      ip_hash: "abc",
    });
    const rows = await store.listContacts();
    expect(rows).toHaveLength(1);
  });
});
