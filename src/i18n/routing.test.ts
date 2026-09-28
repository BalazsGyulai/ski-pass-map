import { describe, expect, it } from "vitest";
import { BASE_PATH } from "@/lib/site";
import { langPath, parseLangPath, pathWithLang } from "./routing";

describe("localized paths", () => {
  it("gives next/link and the router paths without the base path", () => {
    expect(langPath("en", "/")).toBe("/en/");
    expect(langPath("en", "")).toBe("/en/");
    expect(langPath("de", "/plan")).toBe("/de/plan/");
    expect(langPath("hu", "passes/")).toBe("/hu/passes/");
  });

  it("adds the base path exactly once for plain anchors", () => {
    expect(pathWithLang("en", "/")).toBe(`${BASE_PATH}/en/`);
    expect(pathWithLang("de", "/plan")).toBe(`${BASE_PATH}/de/plan/`);
    if (BASE_PATH) expect(pathWithLang("de", "/plan")).not.toContain(`${BASE_PATH}${BASE_PATH}`);
  });

  it("parses both forms back to the same language and page", () => {
    expect(parseLangPath(langPath("de", "/plan"))).toEqual({ lang: "de", rest: "/plan" });
    expect(parseLangPath(pathWithLang("de", "/plan"))).toEqual({ lang: "de", rest: "/plan" });
  });
});
