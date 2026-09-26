import { describe, expect, it } from "vitest";
import { normalizeContactBody } from "./validation";

describe("contact validation", () => {
  it("requires privacy acceptance and message length", () => {
    const fail = normalizeContactBody({
      lang: "en",
      category: "general",
      message: "short",
      privacyAccepted: true,
      turnstileToken: "tok",
    });
    expect(fail.ok).toBe(false);
    const ok = normalizeContactBody({
      lang: "en",
      category: "general",
      message: "This is a long enough message.",
      privacyAccepted: true,
      turnstileToken: "tok",
    });
    expect(ok.ok).toBe(true);
  });

  it("rejects missing privacy checkbox", () => {
    const parsed = normalizeContactBody({
      lang: "en",
      category: "general",
      message: "This is a long enough message.",
      privacyAccepted: false,
      turnstileToken: "tok",
    });
    expect(parsed.ok).toBe(false);
  });
});
