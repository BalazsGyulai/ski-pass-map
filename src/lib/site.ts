import site from "../../config/site.json";

/** Working product name. Change it here; the header, document title, and manifest follow this value. */
export const SITE_NAME = site.name;

/**
 * Path prefix for the static export.
 * Unset uses config/site.json (GitHub Pages). Set NEXT_PUBLIC_BASE_PATH to an empty string for the site root on Cloudflare Pages.
 */
export function resolveBasePath(fromEnv: string | undefined = process.env.NEXT_PUBLIC_BASE_PATH): string {
  if (fromEnv === undefined) return site.basePath;
  return fromEnv;
}

export const BASE_PATH = resolveBasePath();
