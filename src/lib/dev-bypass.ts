/** Local-only dev bypass for admin/portal APIs. Never active on Cloudflare Pages hostnames. */

export function requestHostname(request: Request): string {
  try {
    return new URL(request.url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isLocalDevHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function isLocalDevRequest(request: Request): boolean {
  return isLocalDevHostname(requestHostname(request));
}

export function isHostedPagesHostname(hostname: string): boolean {
  return hostname.endsWith(".pages.dev") || hostname.endsWith(".workers.dev");
}

export function adminDevBypassAllowed(request: Request, env: { ADMIN_DEV_BYPASS?: string }): boolean {
  if (env.ADMIN_DEV_BYPASS !== "1") return false;
  const host = requestHostname(request);
  if (!isLocalDevHostname(host)) return false;
  if (isHostedPagesHostname(host)) return false;
  return true;
}

export function portalDevBypassAllowed(request: Request, env: { PORTAL_DEV_BYPASS?: string }): boolean {
  if (env.PORTAL_DEV_BYPASS !== "1") return false;
  const host = requestHostname(request);
  if (!isLocalDevHostname(host)) return false;
  if (isHostedPagesHostname(host)) return false;
  return true;
}
