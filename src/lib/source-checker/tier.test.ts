import { describe, expect, it } from "vitest";
import { classifyTier } from "@/lib/admin/edits";
import { mergeCheckerResults } from "./tier";

describe("tier logic", () => {
  it("classifies promos as tier C", () => {
    expect(classifyTier([{ path: "promo.banner", before: "a", after: "b", kind: "text" }])).toBe("C");
  });

  it("auto publishes tier A when deterministic and AI agree", () => {
    const deterministic = [{ path: "lifts", verdict: "supported" as const, snippet: "12 lifts" }];
    const ai = [{ path: "lifts", verdict: "supported" as const, snippet: "12 lifts" }];
    const summary = mergeCheckerResults("A", deterministic, ai);
    expect(summary.autoPublishable).toBe(true);
  });

  it("never auto publishes tier B", () => {
    const deterministic = [{ path: "price", verdict: "supported" as const, snippet: "59" }];
    const summary = mergeCheckerResults("B", deterministic, deterministic);
    expect(summary.autoPublishable).toBe(false);
  });
});
