import { describe, expect, it } from "vitest";
import { mapboxShowingStatusKey } from "./settings-map-status";

describe("mapboxShowingStatusKey", () => {
  it("reflects token and consent for the active map", () => {
    expect(mapboxShowingStatusKey(true, true)).toBe("mapProviderNowMapbox");
    expect(mapboxShowingStatusKey(false, true)).toBe("mapProviderNowFreeConsentOff");
    expect(mapboxShowingStatusKey(true, false)).toBe("mapProviderNowFreeNoToken");
    expect(mapboxShowingStatusKey(false, false)).toBe("mapProviderNowFreeNoToken");
  });
});
