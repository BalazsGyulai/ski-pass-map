/**
 * Meta policy for GitHub Pages, which cannot set response headers.
 * strict-origin-when-cross-origin still sends an origin Referer to OSM tiles.
 * A no-referrer policy makes tile.openstreetmap.org return a blocked placeholder.
 * script-src and style-src allow unsafe-inline because the static export inlines
 * the theme bootstrap and Next hydration scripts.
 */
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://tiles.opensnowmap.org",
  "connect-src 'self'",
  "font-src 'self' data:",
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");
