import { describe, expect, it } from "vitest";
import { createAppStore } from "@/lib/db/app-store";
import { createTestSqlExecutor } from "@/lib/db/test-sqlite";
import { checkContactRateLimits } from "./rate-limit";

describe("contact rate limits", () => {
  it("blocks after hourly max", async () => {
    const store = createAppStore(createTestSqlExecutor());
    const env = { MAP_LOAD_HASH_SALT: "test-salt-12345678", CONTACT_HOURLY_MAX: "2" };
    const now = Date.now();
    expect((await checkContactRateLimits(store, env, "1.2.3.4", now)).allowed).toBe(true);
    expect((await checkContactRateLimits(store, env, "1.2.3.4", now)).allowed).toBe(true);
    expect((await checkContactRateLimits(store, env, "1.2.3.4", now)).allowed).toBe(false);
  });
});
