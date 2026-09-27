/** Salted SHA-256 hash for rate limiting. Raw IP is never stored. */
export async function hashIp(salt: string, label: string, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${label}|${ip}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function saltFromEnv(value: string | undefined, fallback: string): string {
  const configured = value?.trim();
  if (configured && configured.length >= 8) return configured;
  return fallback;
}
