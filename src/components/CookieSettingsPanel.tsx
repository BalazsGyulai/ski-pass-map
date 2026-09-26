"use client";

import { useEffect, useState } from "react";
import { NECESSARY_STORAGE_KEYS, writeBannerChoice } from "@/lib/consent/banner";
import { getMapConsent, setMapConsent } from "@/lib/map-consent";
import { useApp } from "./AppState";

export function CookieSettingsPanel({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (mapConsent: boolean) => void;
}) {
  const { t } = useApp();
  const [mapOn, setMapOn] = useState(false);

  useEffect(() => {
    setMapOn(getMapConsent());
  }, []);

  return (
    <div className="scrim" data-testid="cookie-settings">
      <button type="button" className="scrim-hit" aria-label={t("close")} onClick={onClose} />
      <div className="cookie-settings-drawer" role="dialog" aria-modal="true" aria-label={t("cookieSettings")}>
        <h2>{t("cookieSettings")}</h2>
        <section>
          <h3>{t("consentNecessaryTitle")}</h3>
          <p>{t("consentNecessaryBody")}</p>
          <ul className="compact-list">
            {NECESSARY_STORAGE_KEYS.map((key) => (
              <li key={key}><code>{key}</code></li>
            ))}
          </ul>
        </section>
        <section>
          <h3>{t("consentMapCategory")}</h3>
          <p>{t("consentMapCategoryDesc")}</p>
          <label className="field row">
            <input type="checkbox" checked={mapOn} onChange={(e) => setMapOn(e.target.checked)} />
            <span>{t("consentMapCategory")}</span>
          </label>
        </section>
        <div className="cookie-settings-actions">
          <button type="button" className="ghost" onClick={onClose}>{t("close")}</button>
          <button type="button" className="primary" onClick={() => onSave(mapOn)}>{t("consentSave")}</button>
        </div>
      </div>
    </div>
  );
}

/** Footer / menu entry opens settings without the first-visit banner. */
export function CookieSettingsOpener({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  if (!open) return null;
  return (
    <CookieSettingsPanel
      onClose={() => onOpenChange(false)}
      onSave={(mapOn) => {
        onOpenChange(false);
        writeBannerChoice(window.localStorage, mapOn ? "accepted" : "rejected");
        setMapConsent(mapOn);
      }}
    />
  );
}
