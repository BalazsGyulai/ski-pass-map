import { describe, expect, it } from "vitest";
import { assertCsrf, formatSessionCookieValue, hashSessionToken, parseSessionCookie } from "./session";

describe("portal session", () => {
  it("parses session cookie", () => {
    const value = formatSessionCookieValue("sid", "tok");
    const parsed = parseSessionCookie(`other=1; skimap_portal_session=${encodeURIComponent(value)}`);
    expect(parsed).toEqual({ sessionId: "sid", token: "tok" });
  });

  it("hashes session tokens", async () => {
    expect(await hashSessionToken("a")).toBe(await hashSessionToken("a"));
  });

  it("checks csrf", () => {
    expect(assertCsrf("abc1234567890123", "abc1234567890123")).toBe(true);
    expect(assertCsrf("abc1234567890123", "wrong")).toBe(false);
  });
});
