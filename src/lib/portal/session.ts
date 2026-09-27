import { sha256Hex } from "./crypto";

export const SESSION_COOKIE = "skimap_portal_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface PortalSessionCookie {
  sessionId: string;
  token: string;
}

export function parseSessionCookie(header: string | null): PortalSessionCookie | null {
  if (!header) return null;
  const match = header.match(/(?:^|;\s*)skimap_portal_session=([^;]+)/);
  if (!match) return null;
  const raw = decodeURIComponent(match[1]!);
  const sep = raw.indexOf(".");
  if (sep < 1) return null;
  return { sessionId: raw.slice(0, sep), token: raw.slice(sep + 1) };
}

export function formatSessionCookieValue(sessionId: string, token: string): string {
  return `${sessionId}.${token}`;
}

export function sessionExpiresAt(createdAtMs: number): number {
  return createdAtMs + SESSION_TTL_MS;
}

export async function hashSessionToken(token: string): Promise<string> {
  return sha256Hex(`portal-session:v1:${token}`);
}

export function assertCsrf(sessionCsrf: string, headerValue: string | null): boolean {
  if (!headerValue || headerValue.length < 16) return false;
  return sessionCsrf === headerValue;
}

export function sessionCookieHeader(sessionId: string, token: string, secure: boolean): string {
  const value = formatSessionCookieValue(sessionId, token);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookieHeader(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
