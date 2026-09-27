import { describe, expect, it } from "vitest";
import { classifyPortalTier, fieldTierLabel } from "./tier-fields";

describe("portal tier classification", () => {
  it("classifies season fields as tier A", () => {
    expect(classifyPortalTier([{ path: "seasonDates.value", before: "a", after: "b", kind: "date" }])).toBe("A");
    expect(fieldTierLabel("seasonDates")).toBe("A");
  });

  it("classifies prices as tier B", () => {
    expect(classifyPortalTier([{ path: "dayTicket.value.eur", before: 1, after: 2, kind: "price" }])).toBe("B");
  });

  it("classifies promos as tier C", () => {
    expect(classifyPortalTier([{ path: "promo.banner", before: "a", after: "b", kind: "text" }])).toBe("C");
  });
});
