import { getMapConsent } from "./map-consent";
import type { MapProviderId } from "./map-styles";

export type CounterOutcome = "mapbox" | "openfreemap" | "error" | "timeout" | "unreachable";

/** Mapbox only when a token, consent, and a granted counter response are all present. */
export function selectMapProvider(input: {
  token: string | null | undefined;
  consented: boolean;
  counter: CounterOutcome;
}): MapProviderId {
  if (!input.token?.trim()) return "openfreemap";
  if (!input.consented) return "openfreemap";
  if (input.counter !== "mapbox") return "openfreemap";
  return "mapbox";
}

/** Short enough that a missing Pages function does not hold the map. */
export const MAP_COUNTER_TIMEOUT_MS = 1500;

/** Development strict mode mounts the map twice. Only a production build may increment the counter. */
export function shouldCountMapLoad(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "production";
}

export function mapLoadEndpoint(): string {
  if (typeof window === "undefined") return "/api/map-load";
  return new URL("/api/map-load", window.location.origin).href;
}

export async function readCounter(options: {
  endpoint: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}): Promise<CounterOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await fetchImpl(options.endpoint, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return "error";
    let parsed: unknown;
    try {
      parsed = JSON.parse(await response.text());
    } catch {
      return "error";
    }
    const provider = parsed && typeof parsed === "object" ? (parsed as { provider?: unknown }).provider : null;
    if (provider === "mapbox" || provider === "openfreemap") return provider;
    return "error";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "timeout";
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveMapProvider(options?: {
  token?: string | null;
  consented?: boolean;
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** Defaults to production builds only, so dev strict mode does not increment. */
  countLoads?: boolean;
}): Promise<MapProviderId> {
  const token = (options?.token !== undefined ? options.token : process.env.NEXT_PUBLIC_MAPBOX_TOKEN) ?? "";
  const consented = options?.consented ?? getMapConsent();
  if (!token.trim() || !consented) return "openfreemap";
  if (!(options?.countLoads ?? shouldCountMapLoad())) return "mapbox";
  const counter = await readCounter({
    endpoint: options?.endpoint ?? mapLoadEndpoint(),
    timeoutMs: options?.timeoutMs ?? MAP_COUNTER_TIMEOUT_MS,
    fetchImpl: options?.fetchImpl,
  });
  return selectMapProvider({ token, consented, counter });
}

/** A Mapbox init failure falls back once. OpenFreeMap has nowhere else to go. */
export function providerAfterFailure(provider: MapProviderId): MapProviderId | "error" {
  return provider === "mapbox" ? "openfreemap" : "error";
}
