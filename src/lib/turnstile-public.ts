import { TURNSTILE_TEST_SITE_KEY } from "@/lib/contact/turnstile";

/** Public Turnstile site key for the contact form widget. */
export function resolveTurnstileSiteKey(fromEnv: string | undefined, nodeEnv: string | undefined): string {
  const configured = fromEnv?.trim();
  if (configured) return configured;
  if (nodeEnv !== "production") return TURNSTILE_TEST_SITE_KEY;
  return "";
}
