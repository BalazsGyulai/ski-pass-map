import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

describe("service worker update policy", () => {
  it("versions the cache per build and drops the old fixed cache", () => {
    expect(sw).toContain('const CACHE = "ski-pass-map-__BUILD_ID__"');
    expect(sw).not.toContain('const CACHE = "ski-pass-map-v1"');
    expect(sw).toContain("keys.filter((key) => key !== CACHE)");
  });

  it("loads documents from the network and only cache-firsts hashed assets", () => {
    expect(sw).toContain("networkFirstDocument");
    expect(sw).toContain('cache: "reload"');
    expect(sw).toContain('url.pathname.includes("/_next/static/")');
    expect(sw).toContain("cacheFirst");
    expect(sw).toContain("usableDocument");
  });

  it("takes control immediately so the previous worker cannot keep serving stale HTML", () => {
    expect(sw).toContain("self.skipWaiting()");
    expect(sw).toContain("self.clients.claim()");
    expect(sw).toContain("client.navigate(client.url)");
  });
});
