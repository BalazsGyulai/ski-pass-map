import { isLocalDevRequest } from "./dev-bypass";

/** Trust CF-Connecting-IP only. Do not use X-Forwarded-For (spoofable off Cloudflare). */
export function clientIpFromRequest(request: Request, localFallback = "127.0.0.1"): string {
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  if (isLocalDevRequest(request)) return localFallback;
  return "unknown";
}
