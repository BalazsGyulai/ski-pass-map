import { describe, expect, it } from "vitest";
import { filterResortsForListing } from "./overrides";
import { applyListingToMapVisibility, normalizeListingMode } from "./listing";

describe("listing modes", () => {
  it("defaults to full", () => {
    expect(normalizeListingMode(undefined)).toBe("full");
  });

  it("hides unlisted resorts", () => {
    const resorts = [{ id: "a" }, { id: "b" }];
    const out = filterResortsForListing(resorts, { b: "unlisted" }, { a: "full", b: "full" });
    expect(out.map((r) => r.id)).toEqual(["a"]);
    expect(applyListingToMapVisibility("b", "full", new Map([["b", "unlisted"]]))).toBe(false);
  });
});
