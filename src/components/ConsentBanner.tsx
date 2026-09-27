"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { shouldShowCookieBanner, writeBannerChoice } from "@/lib/consent/banner";
import { overlayClearance, setBottomOverlay } from "@/lib/overlay-layout";
import { setMapConsent } from "@/lib/map-consent";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { CookieSettingsPanel } from "./CookieSettingsPanel";

export function ConsentBanner() {
  const { t } = useApp();
  const href = useLocalizedPath();
  const [visible, setVisible] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(shouldShowCookieBanner(window.localStorage));
  }, []);

  const pending = visible || settingsOpen;

  useEffect(() => {
    if (!pending) {
      setBottomOverlay(null);
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    // Pages pad their bottom by the room the card takes (tab bar included) so nothing hides under it.
    const host = el.closest<HTMLElement>(".consent-banner-host");
    const measure = () => setBottomOverlay(settingsOpen ? "cookie-settings" : "consent", host ? overlayClearance(host) : el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      if (!shouldShowCookieBanner(window.localStorage) && !settingsOpen) setBottomOverlay(null);
    };
  }, [pending, settingsOpen, visible]);

  const dismiss = useCallback((accepted: boolean) => {
    writeBannerChoice(window.localStorage, accepted ? "accepted" : "rejected");
    setMapConsent(accepted);
    setVisible(false);
    setSettingsOpen(false);
    setBottomOverlay(null);
    window.dispatchEvent(new Event("skimap-consent-resolved"));
  }, []);

  if (!visible && !settingsOpen) return null;

  // Reject and Accept look the same on purpose; Settings is the quieter third choice.
  return (
    <>
      {visible ? (
        <div className="consent-banner-host" data-testid="consent-banner" role="presentation">
          <aside className="consent-banner" role="dialog" aria-label={t("cookieSettings")} aria-describedby="consent-banner-text">
            <div className="consent-banner-card" ref={cardRef}>
              <p className="consent-banner-text" id="consent-banner-text">
                {t("consentBannerIntro")} <Link href={href("/privacy")}>{t("privacy")}</Link>.
              </p>
              <div className="consent-banner-actions">
                <button
                  type="button"
                  className="consent-settings-link"
                  onClick={() => {
                    setVisible(false);
                    setSettingsOpen(true);
                  }}
                >
                  {t("consentSettings")}
                </button>
                <button type="button" className="consent-eq" onClick={() => dismiss(false)}>
                  {t("consentReject")}
                </button>
                <button type="button" className="consent-eq" onClick={() => dismiss(true)}>
                  {t("consentAccept")}
                </button>
              </div>
            </div>
          </aside>
        </div>
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
            setBottomOverlay(null);
            window.dispatchEvent(new Event("skimap-consent-resolved"));
          }}
        />
      ) : null}
    </>
  );
}
