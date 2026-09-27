import { describe, expect, it } from "vitest";
import { applySourceCheckerDevEnv, assertSafeHttpUrl, isBlockedHost } from "./ssrf";

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

  it("allows fixture host and port only with dev flag on localhost", () => {
    const localReq = new Request("http://127.0.0.1/fixtures/source.html");
    applySourceCheckerDevEnv(
      {
        SOURCE_CHECKER_DEV_FIXTURE: "1",
        SOURCE_CHECKER_DEV_HOSTS: "127.0.0.1",
      },
      localReq,
    );
    const url = assertSafeHttpUrl("http://127.0.0.1:8788/fixtures/source.html");
    expect(url.port).toBe("8788");
    applySourceCheckerDevEnv(
      { SOURCE_CHECKER_DEV_FIXTURE: "1", SOURCE_CHECKER_DEV_HOSTS: "127.0.0.1" },
      new Request("https://skimap.pages.dev/api/admin/check"),
    );
    expect(() => assertSafeHttpUrl("http://127.0.0.1:8788/fixtures/source.html")).toThrow();
  });
});
