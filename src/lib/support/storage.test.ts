import { describe, expect, it } from "vitest";
import {
  hasCompletedFirstVisit,
  markFirstVisitDone,
  readSupportDaily,
  recordSupportPromptShown,
  shouldShowSupportPrompt,
} from "./storage";

describe("support prompt storage", () => {
  const storage = new Map<string, string>();
  const mock = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  } as Storage;

  it("blocks until first visit is marked", () => {
    storage.clear();
    expect(shouldShowSupportPrompt({ storage: mock, now: Date.now(), dev: false, search: "" })).toBe(false);
    markFirstVisitDone(mock);
    expect(hasCompletedFirstVisit(mock)).toBe(true);
    expect(shouldShowSupportPrompt({ storage: mock, now: Date.now(), dev: false, search: "" })).toBe(true);
  });

  it("caps at four prompts per utc day", () => {
    storage.clear();
    markFirstVisitDone(mock);
    const now = Date.UTC(2026, 8, 26, 12);
    for (let i = 0; i < 4; i++) recordSupportPromptShown(mock, now);
    expect(readSupportDaily(mock, now).count).toBe(4);
    expect(shouldShowSupportPrompt({ storage: mock, now, dev: false, search: "" })).toBe(false);
  });
});
