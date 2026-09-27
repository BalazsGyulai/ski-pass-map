import { describe, expect, it, vi } from "vitest";

describe("affiliate links", () => {
  it("is hidden when config is empty", async () => {
    vi.resetModules();
    const mod = await import("./affiliates");
    expect(mod.hasAffiliateLinks()).toBe(false);
    expect(mod.getAffiliateLinks()).toEqual([]);
  });
});
