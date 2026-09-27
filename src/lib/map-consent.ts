/** Storage consent for the Mapbox map. Part 8's banner calls setMapConsent. Until then this stays off. */
export const MAP_CONSENT_STORAGE_KEY = "skimap-map-consent";
export const MAP_CONSENT_EVENT = "skimap-map-consent";

export interface MapConsentRead {
  stored: string | null;
  /** Raw query string, with or without the leading `?`. */
  search: string;
  /** True only for local dev and unit tests. Production builds must pass false. */
  dev: boolean;
  envFlag?: string;
}

/**
 * Consent is off unless storage says "1".
 * In dev, `?mapConsent=1` or NEXT_PUBLIC_MAP_CONSENT=1 simulates a yes, and `?mapConsent=0` simulates a no.
 * Production ignores the query flag and the env flag.
 */
export function readMapConsent(input: MapConsentRead): boolean {
  if (input.dev) {
    const params = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
    const query = params.get("mapConsent");
    if (query === "1" || query === "true") return true;
    if (query === "0" || query === "false") return false;
    if (input.envFlag === "1" || input.envFlag === "true") return true;
  }
  return input.stored === "1";
}

export function writeMapConsent(
  consented: boolean,
  storage: { setItem(key: string, value: string): void },
  emit: (consented: boolean) => void,
): void {
  storage.setItem(MAP_CONSENT_STORAGE_KEY, consented ? "1" : "0");
  emit(consented);
}

export function getMapConsent(): boolean {
  if (typeof window === "undefined") return false;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(MAP_CONSENT_STORAGE_KEY);
  } catch {
    stored = null;
  }
  return readMapConsent({
    stored,
    search: window.location.search,
    dev: process.env.NODE_ENV !== "production",
    envFlag: process.env.NEXT_PUBLIC_MAP_CONSENT,
  });
}

export function setMapConsent(consented: boolean): void {
  if (typeof window === "undefined") return;
  writeMapConsent(consented, window.localStorage, (value) => {
    window.dispatchEvent(new CustomEvent(MAP_CONSENT_EVENT, { detail: value }));
  });
}

export function onMapConsentChange(listener: (consented: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<boolean>).detail;
    listener(typeof detail === "boolean" ? detail : getMapConsent());
  };
  window.addEventListener(MAP_CONSENT_EVENT, handler);
  return () => window.removeEventListener(MAP_CONSENT_EVENT, handler);
}
