import { describe, expect, it } from "vitest";
import { readBannerChoice, shouldShowCookieBanner, writeBannerChoice } from "./banner";

describe("cookie banner", () => {
  const storage = new Map<string, string>();
  const mock = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  } as Storage;

  it("shows until a choice is stored", () => {
    storage.clear();
    expect(shouldShowCookieBanner(mock)).toBe(true);
    writeBannerChoice(mock, "rejected");
    expect(shouldShowCookieBanner(mock)).toBe(false);
    expect(readBannerChoice(mock)).toBe("rejected");
  });
});
