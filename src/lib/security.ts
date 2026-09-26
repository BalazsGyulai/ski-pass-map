/**
 * Meta policy for GitHub Pages, which cannot set response headers.
 * strict-origin-when-cross-origin still sends an origin Referer. OpenSnowMap
 * refuses the piste overlay when the Referer is missing.
 * script-src and style-src allow unsafe-inline because the static export inlines
 * the theme bootstrap and Next hydration scripts.
 * MapLibre starts a same-origin module worker. Mapbox GL starts a blob worker.
 * Vector tiles, glyphs, and sprites come from OpenFreeMap, and from Mapbox only
 * when that provider is chosen.
 */
export const REFERRER_POLICY = "strict-origin-when-cross-origin";

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src https://challenges.cloudflare.com",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "form-action 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://tiles.opensnowmap.org https://api.mapbox.com https://*.tiles.mapbox.com",
  "connect-src 'self' https://tiles.openfreemap.org https://tiles.opensnowmap.org https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://challenges.cloudflare.com https://cloudflareinsights.com",
  "frame-ancestors 'none'",
  "font-src 'self' data: https://tiles.openfreemap.org https://api.mapbox.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");
