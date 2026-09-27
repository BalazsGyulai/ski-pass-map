import { sha256Hex } from "./crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function inviteExpiresAt(createdAtMs: number): number {
  return createdAtMs + INVITE_TTL_MS;
}

export function isInviteExpired(expiresAtMs: number, nowMs = Date.now()): boolean {
  return nowMs >= expiresAtMs;
}

export async function hashInviteToken(token: string): Promise<string> {
  return sha256Hex(`invite:v1:${token}`);
}

export function parseEmailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || domain.includes("@")) return null;
  return domain;
}

export function hostFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/** Owner should only invite addresses on the resort's official website domain. */
export function emailDomainMatchesResortSite(email: string, officialWebsite: string | null | undefined): {
  ok: boolean;
  emailDomain: string | null;
  siteDomain: string | null;
} {
  const emailDomain = parseEmailDomain(email);
  const siteDomain = officialWebsite ? hostFromUrl(officialWebsite) : null;
  if (!emailDomain || !siteDomain) return { ok: false, emailDomain, siteDomain };
  return { ok: emailDomain === siteDomain || emailDomain.endsWith(`.${siteDomain}`), emailDomain, siteDomain };
}
