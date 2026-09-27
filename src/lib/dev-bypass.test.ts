import { describe, expect, it } from "vitest";
import { adminDevBypassAllowed, portalDevBypassAllowed } from "./dev-bypass";

describe("dev bypass host rules", () => {
  const adminEnv = { ADMIN_DEV_BYPASS: "1" };
  const portalEnv = { PORTAL_DEV_BYPASS: "1" };

  it("allows 127.0.0.1 and localhost only", () => {
    expect(adminDevBypassAllowed(new Request("http://127.0.0.1/api"), adminEnv)).toBe(true);
    expect(portalDevBypassAllowed(new Request("http://localhost:8788/api"), portalEnv)).toBe(true);
  });

  it("blocks pages.dev even when bypass flag is set", () => {
    expect(adminDevBypassAllowed(new Request("https://preview.pages.dev/api"), adminEnv)).toBe(false);
    expect(portalDevBypassAllowed(new Request("https://skimap.pages.dev/api"), portalEnv)).toBe(false);
  });
});
