import site from "../../config/site.json";

/** Working product name. Change it here; the header, document title, and manifest follow this value. */
export const SITE_NAME = site.name;

/**
 * Path prefix for the static export.
 * Unset uses config/site.json (GitHub Pages). Set NEXT_PUBLIC_BASE_PATH to an empty string for the site root on Cloudflare Pages.
 * When CF_PAGES=1 and NEXT_PUBLIC_BASE_PATH is unset, the base path is empty (Cloudflare serves from the domain root).
 */
export function resolveBasePath(
  fromEnv: string | undefined = process.env.NEXT_PUBLIC_BASE_PATH,
  cfPages: string | undefined = process.env.CF_PAGES,
): string {
  if (fromEnv !== undefined) return fromEnv;
  if (cfPages === "1") return "";
  return site.basePath;
}

export const BASE_PATH = resolveBasePath();

/** Public site origin for sitemap and hreflang (no trailing slash). */
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "https://skimap.eu";
