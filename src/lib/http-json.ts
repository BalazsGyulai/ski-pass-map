export function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
  return new Response(JSON.stringify(body), { status, headers });
}

export function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  const origins: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      origins.push(new URL(trimmed).origin);
    } catch {
      origins.push(trimmed);
    }
  }
  return origins;
}

export function originAllowed(request: Request, extraOrigins: string[]): boolean {
  const header = request.headers.get("origin");
  if (!header) return false;
  let origin: string;
  try {
    origin = new URL(header).origin;
  } catch {
    return false;
  }
  let self = "";
  try {
    self = new URL(request.url).origin;
  } catch {
    self = "";
  }
  return origin === self || extraOrigins.includes(origin);
}

export async function readJsonBody<T>(request: Request, maxBytes = 32_768): Promise<T | null> {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maxBytes) return null;
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
