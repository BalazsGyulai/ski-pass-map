import { describe, expect, it } from "vitest";
import { mapStatusText } from "./settings-map-status";

const base = { consent: true, hasToken: true, trialVisits: 3, formatDate: (ms: number) => new Date(ms).toISOString().slice(0, 10) };

describe("mapStatusText", () => {
  it("names the free map when there is no token or no consent", () => {
    expect(mapStatusText({ ...base, hasToken: false, access: { allowed: false, reason: "used" } }).key).toBe("mapProviderNowFreeNoToken");
    expect(mapStatusText({ ...base, consent: false, access: { allowed: true, reason: "trial", newVisit: true, visitsLeft: 2 } }).key).toBe("mapProviderNowFreeConsentOff");
  });

  it("counts the free visits down, then says they are used", () => {
    expect(mapStatusText({ ...base, access: { allowed: true, reason: "trial", newVisit: true, visitsLeft: 2 } })).toEqual({ key: "mapAccessTrial", vars: { n: 2 } });
    expect(mapStatusText({ ...base, access: { allowed: true, reason: "trial", newVisit: false, visitsLeft: 0 } })).toEqual({ key: "mapAccessTrialLast" });
    expect(mapStatusText({ ...base, access: { allowed: false, reason: "used" } })).toEqual({ key: "mapAccessUsed", vars: { n: 3 } });
  });

  it("shows when a supporter period ends", () => {
    const until = Date.UTC(2026, 10, 2);
    expect(mapStatusText({ ...base, access: { allowed: true, reason: "supporter", until } })).toEqual({ key: "mapAccessSupporter", vars: { date: "2026-11-02" } });
  });
});
