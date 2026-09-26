import { describe, expect, it } from "vitest";
import { linkOnResortDomain, promoSubmitSchema } from "./promo-submit";

describe("portal promo submit", () => {
  it("validates text length", () => {
    expect(promoSubmitSchema.safeParse({ resortId: "x", text: "a", ownerLicenceAccepted: true }).success).toBe(true);
    expect(promoSubmitSchema.safeParse({ resortId: "x", text: "x".repeat(201), ownerLicenceAccepted: true }).success).toBe(false);
  });

  it("checks link domain when website known", () => {
    expect(linkOnResortDomain(null, "skimap-12357")).toBe(true);
    expect(linkOnResortDomain("https://evil.example/", "skimap-12357")).toBe(false);
  });
});
