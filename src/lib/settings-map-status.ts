import type { MapboxAccess } from "./map-access";
import type { MessageKey } from "./i18n";

export interface MapStatusText {
  key: MessageKey;
  vars?: Record<string, string | number>;
}

/**
 * What the map shows for this visitor, for Settings. `formatDate` turns the supporter period's end
 * (ms) into display text.
 */
export function mapStatusText(input: {
  consent: boolean;
  hasToken: boolean;
  access: MapboxAccess;
  trialVisits: number;
  formatDate: (ms: number) => string;
}): MapStatusText {
  if (!input.hasToken) return { key: "mapProviderNowFreeNoToken" };
  if (!input.consent) return { key: "mapProviderNowFreeConsentOff" };
  const access = input.access;
  if (access.reason === "supporter") return { key: "mapAccessSupporter", vars: { date: input.formatDate(access.until) } };
  if (access.reason === "trial") return access.visitsLeft > 0 ? { key: "mapAccessTrial", vars: { n: access.visitsLeft } } : { key: "mapAccessTrialLast" };
  return { key: "mapAccessUsed", vars: { n: input.trialVisits } };
}
