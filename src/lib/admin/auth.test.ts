import { describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, SignJWT } from "jose";
import { devBypassActive, parseAdminEmails, verifyAdminRequest } from "./auth";

describe("admin auth", () => {
  it("parses admin emails", () => {
    expect(parseAdminEmails("a@x.com, B@y.com ")).toEqual(["a@x.com", "b@y.com"]);
  });

  it("never enables dev bypass in production", () => {
    expect(devBypassActive({ ADMIN_DEV_BYPASS: "1", NODE_ENV: "production" })).toBe(false);
    expect(devBypassActive({ ADMIN_DEV_BYPASS: "1", NODE_ENV: "development" })).toBe(true);
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

  it("allows dev bypass only outside production", async () => {
    const request = new Request("https://skimap.test/api/admin/messages");
    const identity = await verifyAdminRequest(request, {
      ADMIN_DEV_BYPASS: "1",
      ADMIN_EMAILS: "dev@skimap.test",
      NODE_ENV: "development",
    });
    expect(identity?.bypass).toBe(true);
  });
});
