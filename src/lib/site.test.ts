import { describe, expect, it } from "vitest";
import site from "../../config/site.json";
import { resolveBasePath } from "./site";

describe("resolveBasePath", () => {
  it("uses site.json when no env overrides are set", () => {
    expect(resolveBasePath(undefined, undefined)).toBe(site.basePath);
  });

  it("honours NEXT_PUBLIC_BASE_PATH over CF_PAGES", () => {
    expect(resolveBasePath("", "1")).toBe("");
    expect(resolveBasePath("/custom", "1")).toBe("/custom");
  });

  it("uses empty base path on Cloudflare Pages builds", () => {
    expect(resolveBasePath(undefined, "1")).toBe("");
  });
});
