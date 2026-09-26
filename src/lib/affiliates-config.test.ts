import { describe, expect, it, vi, beforeEach } from "vitest";

describe("affiliate config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exposes rel sponsored on link objects", async () => {
    vi.doMock("../../config/affiliates.json", () => ({
      default: {
        ski_rental: [{ label: "Demo", url: "https://example.test", category: "ski_rental" }],
      },
    }));
    const { getAffiliateLinks, hasAffiliateLinks } = await import("./affiliates");
    expect(hasAffiliateLinks()).toBe(true);
    expect(getAffiliateLinks()[0].url).toContain("example.test");
  });
});
