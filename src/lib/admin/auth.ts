import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { adminDevBypassAllowed } from "@/lib/dev-bypass";

export interface AdminAuthEnv {
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ADMIN_EMAILS?: string;
  ADMIN_DEV_BYPASS?: string;
  NODE_ENV?: string;
}

export interface AdminIdentity {
  email: string;
  bypass: boolean;
}

let jwksCache: { url: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null;

function jwksForTeam(teamDomain: string) {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (!jwksCache || jwksCache.url !== url) {
    jwksCache = { url, jwks: createRemoteJWKSet(new URL(url)) };
  }
  return jwksCache.jwks;
}

export function parseAdminEmails(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function devBypassActive(request: Request, env: AdminAuthEnv): boolean {
  return adminDevBypassAllowed(request, env);
}

export async function verifyAdminRequest(request: Request, env: AdminAuthEnv): Promise<AdminIdentity | null> {
  if (devBypassActive(request, env)) {
    const headerEmail = request.headers.get("x-admin-dev-email")?.trim().toLowerCase();
    const emails = parseAdminEmails(env.ADMIN_EMAILS);
    const email = headerEmail && emails.includes(headerEmail) ? headerEmail : emails[0];
    if (!email) return null;
    return { email, bypass: true };
  }
  const aud = env.ACCESS_AUD?.trim();
  const team = env.ACCESS_TEAM_DOMAIN?.trim();
  if (!aud || !team) return null;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, jwksForTeam(team), {
      audience: aud,
      issuer: `https://${team}`,
    });
    payload = verified.payload;
  } catch {
    return null;
  }
  const email = String(payload.email ?? payload.sub ?? "").toLowerCase();
  if (!email) return null;
  const allowed = parseAdminEmails(env.ADMIN_EMAILS);
  if (!allowed.includes(email)) return null;
  return { email, bypass: false };
}
