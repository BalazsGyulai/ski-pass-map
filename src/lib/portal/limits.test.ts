import { describe, expect, it } from "vitest";
import { countChangeExceedsLimit, dateChangeExceedsLimit, evaluateChangeLimits, wouldExceedDailyFieldCap } from "./limits";

describe("portal change limits", () => {
  it("enforces count delta ratio", () => {
    expect(countChangeExceedsLimit(100, 120)).toBe(false);
    expect(countChangeExceedsLimit(100, 140)).toBe(true);
  });

  it("enforces date delta", () => {
    expect(dateChangeExceedsLimit("2026-01-01", "2026-02-01")).toBe(false);
    expect(dateChangeExceedsLimit("2026-01-01", "2026-05-01")).toBe(true);
  });

  it("aggregates limit reasons", () => {
    const verdict = evaluateChangeLimits([{ path: "lifts", before: 10, after: 20, kind: "lift" }]);
    expect(verdict.withinLimits).toBe(false);
    expect(verdict.reasons[0]).toMatch(/count_limit/);
  });

  it("caps daily fields", () => {
    expect(wouldExceedDailyFieldCap(9, 1)).toBe(false);
    expect(wouldExceedDailyFieldCap(10, 1)).toBe(true);
  });
});
