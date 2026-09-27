import { describe, expect, it } from "vitest";
import { MAP_CONSENT_STORAGE_KEY, readMapConsent, writeMapConsent } from "./map-consent";

describe("map consent", () => {
  it("stays off until storage says yes", () => {
    expect(readMapConsent({ stored: null, search: "", dev: false })).toBe(false);
    expect(readMapConsent({ stored: "0", search: "", dev: false })).toBe(false);
    expect(readMapConsent({ stored: "yes", search: "", dev: false })).toBe(false);
    expect(readMapConsent({ stored: "1", search: "", dev: false })).toBe(true);
  });

  it("ignores the dev query flag and env flag in production", () => {
    expect(readMapConsent({ stored: null, search: "?mapConsent=1", dev: false, envFlag: "1" })).toBe(false);
    expect(readMapConsent({ stored: "1", search: "?mapConsent=0", dev: false, envFlag: "0" })).toBe(true);
  });

  it("lets a dev query flag or env flag simulate consent", () => {
    expect(readMapConsent({ stored: null, search: "?mapConsent=1", dev: true })).toBe(true);
    expect(readMapConsent({ stored: null, search: "mapConsent=true", dev: true })).toBe(true);
    expect(readMapConsent({ stored: "1", search: "?mapConsent=0", dev: true })).toBe(false);
    expect(readMapConsent({ stored: "1", search: "?mapConsent=false", dev: true })).toBe(false);
    expect(readMapConsent({ stored: null, search: "", dev: true, envFlag: "1" })).toBe(true);
    expect(readMapConsent({ stored: null, search: "", dev: true, envFlag: "true" })).toBe(true);
    expect(readMapConsent({ stored: null, search: "", dev: true, envFlag: "0" })).toBe(false);
    expect(readMapConsent({ stored: null, search: "?other=1", dev: true })).toBe(false);
  });

  it("writes 1 or 0 and emits the new value", () => {
    const saved = new Map<string, string>();
    const events: boolean[] = [];
    const storage = { setItem: (key: string, value: string) => saved.set(key, value) };
    writeMapConsent(true, storage, (value) => events.push(value));
    writeMapConsent(false, storage, (value) => events.push(value));
    expect(saved.get(MAP_CONSENT_STORAGE_KEY)).toBe("0");
    expect(events).toEqual([true, false]);
    expect(readMapConsent({ stored: saved.get(MAP_CONSENT_STORAGE_KEY) ?? null, search: "", dev: false })).toBe(false);
  });
});
