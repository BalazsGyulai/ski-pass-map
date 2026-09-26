"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getMapConsent, setMapConsent } from "@/lib/map-consent";
import { showDevTodo } from "@/lib/show-todo";
import { BirthYearField } from "./BirthYearField";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { legalLinks } from "./MenuDrawer";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

export function SettingsView() {
  const {
    t,
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
  const [providerLabel, setProviderLabel] = useState<string>(t("mapProviderFree"));

  useEffect(() => {
    setMapConsentLocal(getMapConsent());
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
    const using = token && getMapConsent() ? t("mapProviderMapbox") : t("mapProviderFree");
    setProviderLabel(using);
  }, [t]);

  function onImportFile(file: File) {
    void file.text().then((text) => {
      const ok = importSavedData(text);
      showToast(ok ? t("dataImported") : t("importInvalid"));
    });
  }

  return (
    <div className="page-shell settings-page">
      <h1>{t("settingsTitle")}</h1>

      <section className="settings-section" aria-labelledby="settings-lang">
        <h2 id="settings-lang">{t("settingsSectionLanguage")}</h2>
        <LanguageSwitcher />
      </section>

      <section className="settings-section" aria-labelledby="settings-appearance">
        <h2 id="settings-appearance">{t("settingsSectionAppearance")}</h2>
        <label className="field">
          <span>{t("theme")}</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as "system" | "light" | "dark")}>
            <option value="system">{t("themeSystem")}</option>
            <option value="light">{t("themeLight")}</option>
            <option value="dark">{t("themeDark")}</option>
          </select>
        </label>
      </section>

      <section className="settings-section" aria-labelledby="settings-map">
        <h2 id="settings-map">{t("settingsSectionMap")}</h2>
        <p className="hint">{t("mapProviderCurrent", { provider: providerLabel })}</p>
        <label className="field row">
          <input
            type="checkbox"
            checked={mapConsent}
            onChange={(event) => {
              setMapConsent(event.target.checked);
              setMapConsentLocal(event.target.checked);
              const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim();
              setProviderLabel(token && event.target.checked ? t("mapProviderMapbox") : t("mapProviderFree"));
            }}
          />
          <span>{t("consentMapCategory")}</span>
        </label>
        <p className="hint">{t("consentMapCategoryDesc")}</p>
        <label className="field row">
          <input
            type="checkbox"
            checked={pisteOverlayDefault}
            onChange={(event) => {
              setPisteOverlayDefault(event.target.checked);
              if (event.target.checked) updateShare({ showPistes: true });
            }}
          />
          <span>{t("pisteOverlayDefault")}</span>
        </label>
        <label className="field">
          <span>{t("unitsLabel")}</span>
          <select value={distanceUnits} onChange={(event) => setDistanceUnits(event.target.value as "km" | "mi")}>
            <option value="km">{t("unitsKm")}</option>
            <option value="mi">{t("unitsMi")}</option>
          </select>
        </label>
      </section>

      <section className="settings-section" aria-labelledby="settings-prices">
        <h2 id="settings-prices">{t("settingsSectionPrices")}</h2>
        <BirthYearField />
        <p className="hint">{t("defaultAdultHint")}</p>
        <label className="field">
          <span>{t("purchaseDate")}</span>
          <input
            type="date"
            value={purchaseDate ?? ""}
            onChange={(event) => setPurchaseDate(event.target.value || null)}
          />
        </label>
      </section>

      <section className="settings-section" aria-labelledby="settings-data">
        <h2 id="settings-data">{t("settingsSectionData")}</h2>
        <p className="hint">
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
      </section>

      <section className="settings-section" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy">{t("settingsSectionPrivacy")}</h2>
        <button type="button" className="ghost" onClick={() => openCookieSettings()}>
          {t("cookieSettings")}
        </button>
        <button type="button" className="ghost" onClick={() => resetSupportReminders()}>
          {t("resetSupportReminders")}
        </button>
      </section>

      <section className="settings-section" aria-labelledby="settings-about">
        <h2 id="settings-about">{t("settingsSectionAbout")}</h2>
        <nav className="settings-links" aria-label={t("settingsSectionAbout")}>
          <Link href={href("/about")}>{t("navAboutSources")}</Link>
          <Link href={href("/contact")}>{t("contact")}</Link>
          <Link href={href("/support")}>
            {t("supportSkimap")} {showDevTodo() ? <span className="todo-tag">{t("todoMark")}</span> : null}
          </Link>
          {legalLinks.map((link) => (
            <Link key={link.rest} href={href(link.rest)}>
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <p className="disclaimer">{t("globalDisclaimer")}</p>
      </section>
    </div>
  );
}
