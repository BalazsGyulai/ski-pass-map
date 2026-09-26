const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function isPrivateIpv4(parts: number[]): boolean {
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

export function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(lower)) return true;
  if (lower.endsWith(".localhost") || lower.endsWith(".local")) return true;
  const ipv4 = parseIpv4(lower);
  if (ipv4 && isPrivateIpv4(ipv4)) return true;
  if (lower.includes(":")) {
    if (lower === "::1" || lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  }
  return false;
}

const devHosts = new Set<string>();

export function setSourceCheckerDevHosts(hosts: string[] | undefined) {
  devHosts.clear();
  for (const host of hosts ?? []) {
    const trimmed = host.trim().toLowerCase();
    if (trimmed) devHosts.add(trimmed);
  }
}

export function assertSafeHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_protocol");
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) throw new Error("invalid_port");
  if (isBlockedHost(url.hostname) && !devHosts.has(url.hostname.toLowerCase())) throw new Error("blocked_host");
  return url;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects: number;
}

export async function safeFetchText(url: string, options: SafeFetchOptions): Promise<{ finalUrl: string; text: string }> {
  let current = assertSafeHttpUrl(url);
  let redirects = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    let response: Response;
    try {
      response = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "SkimapSourceChecker/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect_missing_location");
      if (redirects >= options.maxRedirects) throw new Error("too_many_redirects");
      redirects += 1;
      current = assertSafeHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) return { finalUrl: current.toString(), text: "" };
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > options.maxBytes) throw new Error("response_too_large");
        chunks.push(value);
      }
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(
      chunks.length === 1 ? chunks[0]! : Uint8Array.from(chunks.flatMap((c) => [...c])),
    );
    return { finalUrl: current.toString(), text };
  }
}
