import { describe, expect, it } from "vitest";
import { createAppStore } from "@/lib/db/app-store";
import { createTestSqlExecutor } from "@/lib/db/test-sqlite";
import { checkPortalLoginRate } from "./login-rate";

describe("portal login rate limit", () => {
  it("allows attempts under the cap", async () => {
    const store = createAppStore(createTestSqlExecutor());
    const req = new Request("http://localhost/api/portal/login/options", { method: "POST" });
    for (let i = 0; i < 5; i++) {
      const r = await checkPortalLoginRate(store, req, { MAP_LOAD_HASH_SALT: "test-salt-12345678" });
      expect(r.ok).toBe(true);
    }
  });
});
