import { readFileSync } from "node:fs";
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
    expect(CONTENT_SECURITY_POLICY).toMatch(/img-src [^;]*https:\/\/elevation-tiles-prod\.s3\.amazonaws\.com/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/connect-src [^;]*https:\/\/elevation-tiles-prod\.s3\.amazonaws\.com/);
    expect(CONTENT_SECURITY_POLICY).toContain("worker-src 'self' blob:");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/http:\/\//);
  });

  it("serves the same policy from Cloudflare Pages headers", () => {
    const headers = readFileSync("public/_headers", "utf8");
    const line = headers.split("\n").find((row) => row.trim().startsWith("Content-Security-Policy:"));
    expect(line?.trim().slice("Content-Security-Policy:".length).trim()).toBe(CONTENT_SECURITY_POLICY);
  });
});
