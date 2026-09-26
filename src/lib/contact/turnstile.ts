/** Cloudflare Turnstile always-pass test keys (development only). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
export const TURNSTILE_TEST_SECRET = "1x0000000000000000000000000000000AA";

export interface TurnstileEnv {
  TURNSTILE_SECRET_KEY?: string;
  NODE_ENV?: string;
}

export function resolveTurnstileSecret(env: TurnstileEnv): { secret: string; mode: "configured" | "test" | "missing" } {
  const configured = env.TURNSTILE_SECRET_KEY?.trim();
  if (configured) return { secret: configured, mode: "configured" };
  if (env.NODE_ENV !== "production") return { secret: TURNSTILE_TEST_SECRET, mode: "test" };
  return { secret: "", mode: "missing" };
}

export async function verifyTurnstile(secret: string, token: string, remoteip?: string): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteip) body.set("remoteip", remoteip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (!response.ok) return false;
  const json = (await response.json()) as { success?: boolean };
  return json.success === true;
}
