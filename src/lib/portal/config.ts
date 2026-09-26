import portalConfig from "../../../config/portal.json";

export interface PortalConfig {
  enabled: boolean;
  termsVersion: string;
}

export function readPortalConfig(): PortalConfig {
  return portalConfig as PortalConfig;
}

export function isPortalEnabled(env?: { PORTAL_ENABLED?: string }): boolean {
  if (env?.PORTAL_ENABLED === "1" || env?.PORTAL_ENABLED === "true") return true;
  if (env?.PORTAL_ENABLED === "0" || env?.PORTAL_ENABLED === "false") return false;
  return readPortalConfig().enabled;
}
