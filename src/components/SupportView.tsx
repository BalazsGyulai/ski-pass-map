"use client";

import { SUPPORT_CONFIG } from "@/lib/config/support";
import { useApp } from "./AppState";
import { ExternalSiteLink } from "./ExternalSiteLink";

/** The Support page: what supporting gives you, and the Ko-fi link once config/support.json has one. */
export function SupportView() {
  const { t } = useApp();
  const kofiUrl = SUPPORT_CONFIG.kofiUrl?.trim();
  return (
    <div className="page page-narrow">
      <h1>{t("supportSkimap")}</h1>
      <p className="lede">{t("supportBody")}</p>
      <h2 className="support-perks-title">{t("supportPerksTitle")}</h2>
      <ul className="support-perks">
        <li>{t("supportPerkQuiet")}</li>
        {process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ? <li>{t("supportPerkMap")}</li> : null}
      </ul>
      {kofiUrl ? (
        <p>
          <ExternalSiteLink href={kofiUrl} className="primary">
            {t("supportPromptKofi")}
          </ExternalSiteLink>
        </p>
      ) : (
        <p className="hint">{t("supportNotOpen")}</p>
      )}
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </div>
  );
}
