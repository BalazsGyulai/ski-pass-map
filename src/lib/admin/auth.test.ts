import { describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { devBypassActive, parseAdminEmails, verifyAdminRequest } from "./auth";

describe("admin auth", () => {
  it("parses admin emails", () => {
    expect(parseAdminEmails("a@x.com, B@y.com ")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("never enables dev bypass on pages.dev or without localhost", () => {
    const env = { ADMIN_DEV_BYPASS: "1", ADMIN_EMAILS: "dev@skimap.test" };
    expect(devBypassActive(new Request("https://skimap.pages.dev/api/admin/messages"), env)).toBe(false);
    expect(devBypassActive(new Request("http://127.0.0.1:8788/api/admin/messages"), env)).toBe(true);
    expect(devBypassActive(new Request("http://evil.test/api/admin/messages"), env)).toBe(false);
  });

  it("verifies a JWT against a locally generated JWKS", async () => {
    const team = "team.cloudflareaccess.com";
    const aud = "aud-test";
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const jwk = await exportJWK(publicKey);
    jwk.kid = "test";
    jwk.alg = "RS256";
    const jwks = createLocalJWKSet({ keys: [jwk] });
    const token = await new SignJWT({ email: "admin@skimap.test" })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setAudience(aud)
      .setIssuer(`https://${team}`)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(privateKey);
    const verified = await jwtVerify(token, jwks, { audience: aud, issuer: `https://${team}` });
    expect(verified.payload.email).toBe("admin@skimap.test");
    expect(parseAdminEmails("admin@skimap.test")).toContain("admin@skimap.test");
  });

  it("allows dev bypass only on localhost", async () => {
    const request = new Request("http://127.0.0.1:8788/api/admin/messages");
    const identity = await verifyAdminRequest(request, {
      ADMIN_DEV_BYPASS: "1",
      ADMIN_EMAILS: "dev@skimap.test",
    });
    expect(identity?.bypass).toBe(true);
  });
});
