import { describe, expect, it } from "vitest";
import { assertSafeHttpUrl, isBlockedHost } from "./ssrf";

describe("ssrf guards", () => {
  it("blocks private hosts", () => {
    expect(isBlockedHost("127.0.0.1")).toBe(true);
    expect(isBlockedHost("10.0.0.5")).toBe(true);
    expect(() => assertSafeHttpUrl("http://127.0.0.1/test")).toThrow();
  });

  it("allows public https urls on standard ports", () => {
    const url = assertSafeHttpUrl("https://example.com/page");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects non-http schemes and odd ports", () => {
    expect(() => assertSafeHttpUrl("ftp://example.com")).toThrow();
    expect(() => assertSafeHttpUrl("http://example.com:8080/x")).toThrow();
  });
});
