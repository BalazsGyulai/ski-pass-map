"use client";

import { useCallback, useEffect, useState } from "react";
import { shouldShowCookieBanner, writeBannerChoice } from "@/lib/consent/banner";
import { setMapConsent } from "@/lib/map-consent";
import { useApp } from "./AppState";
import { CookieSettingsPanel } from "./CookieSettingsPanel";

export function ConsentBanner() {
  const { t } = useApp();
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(shouldShowCookieBanner(window.localStorage));
  }, []);

  const dismiss = useCallback((accepted: boolean) => {
    writeBannerChoice(window.localStorage, accepted ? "accepted" : "rejected");
    setMapConsent(accepted);
    setVisible(false);
    setSettingsOpen(false);
  }, []);

  if (!visible && !settingsOpen) return null;

  return (
    <>
      {visible ? (
        <aside className="consent-banner" role="dialog" aria-label={t("cookieSettings")} data-testid="consent-banner">
          <p>{t("consentBannerBody")}</p>
          <div className="consent-banner-actions">
            <button type="button" className="consent-eq" onClick={() => dismiss(false)}>{t("consentReject")}</button>
            <button type="button" className="consent-eq" onClick={() => dismiss(true)}>{t("consentAccept")}</button>
            <button type="button" className="ghost consent-settings" onClick={() => setSettingsOpen(true)}>{t("consentSettings")}</button>
          </div>
        </aside>
      ) : null}
      {settingsOpen ? (
        <CookieSettingsPanel
          onClose={() => {
            setSettingsOpen(false);
            if (shouldShowCookieBanner(window.localStorage)) setVisible(true);
          }}
          onSave={(mapOn) => {
            writeBannerChoice(window.localStorage, mapOn ? "accepted" : "rejected");
            setMapConsent(mapOn);
            setVisible(false);
            setSettingsOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
