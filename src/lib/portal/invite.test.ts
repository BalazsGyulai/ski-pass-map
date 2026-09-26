import { describe, expect, it } from "vitest";
import { emailDomainMatchesResortSite, hashInviteToken, inviteExpiresAt, isInviteExpired } from "./invite";

describe("portal invites", () => {
  it("hashes tokens deterministically", async () => {
    const a = await hashInviteToken("secret-token");
    const b = await hashInviteToken("secret-token");
    expect(a).toBe(b);
    expect(a).not.toBe(await hashInviteToken("other"));
  });

  it("expires after seven days", () => {
    const created = Date.UTC(2026, 0, 1);
    expect(inviteExpiresAt(created)).toBe(created + 7 * 24 * 60 * 60 * 1000);
    expect(isInviteExpired(inviteExpiresAt(created), created + 1)).toBe(false);
    expect(isInviteExpired(inviteExpiresAt(created), inviteExpiresAt(created))).toBe(true);
  });

  it("warns when email domain does not match resort site", () => {
    const ok = emailDomainMatchesResortSite("info@skiwelt.at", "https://www.skiwelt.at/");
    expect(ok.ok).toBe(true);
    const bad = emailDomainMatchesResortSite("info@gmail.com", "https://www.skiwelt.at/");
    expect(bad.ok).toBe(false);
  });
});
