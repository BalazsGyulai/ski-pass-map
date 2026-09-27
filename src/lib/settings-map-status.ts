import type { MessageKey } from "./i18n";

export function mapboxShowingStatusKey(mapConsent: boolean, hasToken: boolean): MessageKey {
  if (hasToken && mapConsent) return "mapProviderNowMapbox";
  if (hasToken && !mapConsent) return "mapProviderNowFreeConsentOff";
  return "mapProviderNowFreeNoToken";
}
