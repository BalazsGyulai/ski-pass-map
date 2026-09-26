import { describe, expect, it } from "vitest";
import { escapeHtml } from "./html";
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from "./security";

describe("escapeHtml", () => {
  it("encodes characters that would break a map marker", () => {
    expect(escapeHtml(`<img src=x onerror=alert(1)>&"'`)).toBe(
      "&lt;img src=x onerror=alert(1)&gt;&amp;&quot;&#39;",
    );
  });
});

describe("security policy", () => {
  it("allows the tile hosts and still sends an origin referrer", () => {
    expect(REFERRER_POLICY).toBe("strict-origin-when-cross-origin");
    expect(REFERRER_POLICY).not.toBe("no-referrer");
    expect(CONTENT_SECURITY_POLICY).toContain("https://tiles.openfreemap.org");
    expect(CONTENT_SECURITY_POLICY).toContain("https://tiles.opensnowmap.org");
    expect(CONTENT_SECURITY_POLICY).toContain("https://api.mapbox.com");
    expect(CONTENT_SECURITY_POLICY).toContain("worker-src 'self' blob:");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/http:\/\//);
  });
});
