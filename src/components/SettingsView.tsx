"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getMapConsent, setMapConsent } from "@/lib/map-consent";
import { BirthYearField } from "./BirthYearField";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { legalLinks } from "./legal-links";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { mapStatusText } from "@/lib/settings-map-status";
import { MAPBOX_TRIAL_VISITS, mapboxAccess, type MapboxAccess } from "@/lib/map-access";
import { SUPPORT_CONFIG } from "@/lib/config/support";
import { formatDate } from "@/lib/format";
import { SegmentedControl, SettingsGroup, SettingsRow, StyledSelect, ToggleSwitch } from "./ui/SettingsControls";

export function SettingsView() {
  const {
    t,
    lang,
    theme,
    setTheme,
    purchaseDate,
    setPurchaseDate,
    openCookieSettings,
    resetSupportReminders,
    updateShare,
    distanceUnits,
    setDistanceUnits,
    pisteOverlayDefault,
    setPisteOverlayDefault,
    terrain3d,
    setTerrain3d,
    exportSavedData,
    importSavedData,
    clearAllSavedData,
    showToast,
    favourites,
    resortDays,
    places,
  } = useApp();
  const href = useLocalizedPath();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mapConsent, setMapConsentLocal] = useState(false);
  const [mapAccess, setMapAccess] = useState<MapboxAccess>({ allowed: true, reason: "trial", newVisit: true, visitsLeft: MAPBOX_TRIAL_VISITS - 1 });
  const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim());
  const canSupport = Boolean(SUPPORT_CONFIG.kofiUrl?.trim()) || SUPPORT_CONFIG.rewardedAdsEnabled;

  useEffect(() => {
    setMapConsentLocal(getMapConsent());
    try {
      setMapAccess(mapboxAccess(window.localStorage));
    } catch {
      // Storage blocked: keep the first-visit status.
    }
  }, []);

  const mapStatus = mapStatusText({
    consent: mapConsent,
    hasToken: hasMapboxToken,
    access: mapAccess,
    trialVisits: MAPBOX_TRIAL_VISITS,
    formatDate: (ms) => formatDate(lang, new Date(ms).toISOString().slice(0, 10)),
  });
  const mapStatusHint = t(mapStatus.key, mapStatus.vars);

  function onImportFile(file: File) {
    void file.text().then((text) => {
      const ok = importSavedData(text);
      showToast(ok ? t("dataImported") : t("importInvalid"));
    });
  }

  return (
    <div className="page-shell settings-page">
      <header className="page-hero">
        <h1>{t("settingsTitle")}</h1>
      </header>

      <SettingsGroup title={t("settingsSectionLanguage")}>
        <SettingsRow label={t("langLabel")}>
          <LanguageSwitcher />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("settingsSectionAppearance")}>
        <SettingsRow label={t("theme")}>
          <SegmentedControl
            ariaLabel={t("theme")}
            value={theme}
            options={[
              { value: "system", label: t("themeSystem") },
              { value: "light", label: t("themeLight") },
              { value: "dark", label: t("themeDark") },
            ]}
            onChange={setTheme}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("settingsSectionMap")}>
        <SettingsRow label={t("mapboxMapLabel")} hint={mapStatusHint}>
          <ToggleSwitch
            label={t("mapboxMapLabel")}
            checked={mapConsent}
            onChange={(on) => {
              setMapConsent(on);
              setMapConsentLocal(on);
            }}
          />
        </SettingsRow>
        <p className="settings-inline-hint">
          {t("mapboxMapHelper", { n: MAPBOX_TRIAL_VISITS })}
          {hasMapboxToken && canSupport ? ` ${t("mapboxSupporterPerk")}` : ""}
        </p>
        <SettingsRow label={t("terrain3d")} hint={t("terrain3dHint")}>
          <ToggleSwitch label={t("terrain3d")} checked={terrain3d} onChange={setTerrain3d} />
        </SettingsRow>
        <SettingsRow label={t("pisteOverlayDefault")}>
          <ToggleSwitch
            label={t("pisteOverlayDefault")}
            checked={pisteOverlayDefault}
            onChange={(on) => {
              setPisteOverlayDefault(on);
              if (on) updateShare({ showPistes: true });
            }}
          />
        </SettingsRow>
        <SettingsRow label={t("unitsLabel")}>
          <StyledSelect
            ariaLabel={t("unitsLabel")}
            value={distanceUnits}
            options={[
              { value: "km", label: t("unitsKm") },
              { value: "mi", label: t("unitsMi") },
            ]}
            onChange={setDistanceUnits}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("settingsSectionPrices")}>
        <BirthYearField />
        <p className="settings-inline-hint">{t("defaultAdultHint")}</p>
        <SettingsRow label={t("purchaseDate")}>
          <input
            className="settings-input"
            type="date"
            value={purchaseDate ?? ""}
            onChange={(event) => setPurchaseDate(event.target.value || null)}
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={t("settingsSectionData")}>
        <p className="settings-inline-hint">
          {favourites.length} favourites · {Object.keys(resortDays).length} plan resorts · {places.length} places
        </p>
        <div className="settings-actions">
          <button type="button" className="ghost" onClick={() => showToast(exportSavedData() ? t("dataExported") : t("importInvalid"))}>
            {t("exportData")}
          </button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>
            {t("importData")}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImportFile(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="ghost warn-btn"
            onClick={() => {
              if (window.confirm(t("clearAllConfirm"))) {
                clearAllSavedData();
                showToast(t("dataCleared"));
              }
            }}
          >
            {t("clearAllData")}
          </button>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t("settingsSectionPrivacy")}>
        <button type="button" className="settings-link-btn" onClick={() => openCookieSettings()}>
          {t("cookieSettings")}
        </button>
        <button type="button" className="settings-link-btn" onClick={() => resetSupportReminders()}>
          {t("resetSupportReminders")}
        </button>
      </SettingsGroup>

      <SettingsGroup title={t("settingsSectionAbout")}>
        <nav className="settings-links" aria-label={t("settingsSectionAbout")}>
          <Link href={href("/about")}>{t("navAboutSources")}</Link>
          {legalLinks.map((link) => (
            <Link key={link.rest} href={href(link.rest)}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
      </SettingsGroup>
    </div>
  );
}
