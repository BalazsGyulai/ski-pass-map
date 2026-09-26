/** Hosts whose resort facts we do not store. Matched as substrings inside data files. */
export const FORBIDDEN_PORTAL_MARKERS = [
  "skiresort.info",
  "skiresort.com",
  "skiresort.at",
  "skiresort.de",
  "skiresort.ch",
  "bergfex.at",
  "bergfex.com",
  "bergfex.de",
  "bergfex.ch",
  "bergfex.it",
  "onthesnow.com",
  "skiinfo.",
  "snow-online.com",
  "snow-forecast.com",
  "snow-forecast.co.uk",
  "snow-forecast",
] as const;

const portalUrl =
  /https?:\/\/(?:[a-z0-9-]+\.)*(?:skiresort\.(?:info|com|at|de|ch)|bergfex\.(?:at|com|de|ch|it)|onthesnow\.com|skiinfo\.[a-z.]+|snow-online\.com|snow-forecast\.(?:com|co\.uk))[^"\\\s]*/gi;

export function portalMarkersIn(text: string): string[] {
  const lower = text.toLowerCase();
  return FORBIDDEN_PORTAL_MARKERS.filter((marker) => lower.includes(marker));
}

/** Drop portal URLs from an OSM extract before it is written into the repo. Geometry is unchanged. */
export function stripPortalUrls(text: string): string {
  return text.replace(portalUrl, "");
}
