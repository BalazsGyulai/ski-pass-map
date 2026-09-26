import { originAllowed } from "@/lib/http-json";

export function assertAdminPostOrigin(request: Request, extraOrigins: string[]): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const sameSite = request.headers.get("sec-fetch-site");
  if (sameSite === "same-origin" || sameSite === "none") {
    return originAllowed(request, extraOrigins);
  }
  return originAllowed(request, extraOrigins);
}
