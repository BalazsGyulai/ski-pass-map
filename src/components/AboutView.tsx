"use client";

import { generated, passes, resorts, unverifiedResortIds } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";
import { formatDate } from "@/lib/format";
import { useApp } from "./AppState";

export function AboutView() {
  const { t, lang } = useApp();
  const updated = generated;

  return (
    <div className="page page-narrow">
      <h1>{t("aboutTitle")}</h1>
      <section className="card-block">
        <h2>{t("disclaimerTitle")}</h2>
        <p>{t("globalDisclaimer")}</p>
        <p>{t("disclaimer")}</p>
        <p>{t("checkOfficial")}</p>
      </section>
      <section className="card-block">
        <h2>{t("seasonLabel", { season: "2026/27" })}</h2>
        <p>{updated ? t("lastUpdated", { date: formatDate(lang, updated) }) : t("updatedUnknown")}</p>
        <p>{t("resortsInData", { n: resorts.length })}</p>
        {unverifiedResortIds.length > 0 ? <p>{t("unverifiedHeld", { n: unverifiedResortIds.length })}</p> : null}
        <p>{t("passesInData", { n: passes.length })}</p>
        <p>{t("pisteTotal", { km: Math.round(resorts.reduce((sum, resort) => sum + (resort.slope_km ?? 0), 0)) })}</p>
        <p>{t("seedBody")}</p>
        <p>{t("gapsBody")}</p>
      </section>
      <section className="card-block">
        <h2>{t("ageTitle")}</h2>
        <p>{t("ageNotBirthYear")}</p>
        <ul className="source-list">
          {passes.map((pass) => (
            <li key={pass.id}>
              <span className="swatch" style={{ background: pass.color }} />
              <div>
                <strong>{pass.name}</strong>
                <p>
                  <a href={pass.url} target="_blank" rel="noopener noreferrer">
                    {t("officialSite")}
                  </a>
                </p>
                <p>
                  <em>{t("sourceNote")}. </em>
                  {pass.price_note}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card-block">
        <h2>{t("storageTitle")}</h2>
        <p>{t("storageBody")}</p>
      </section>
      <section className="card-block">
        <h2>{t("creditsTitle")}</h2>
        <p>{t("creditsOsm")}</p>
        <p>{t("creditsOpenSkiMap")}</p>
        <p>{t("creditsOpenFreeMap")}</p>
        <p>{t("creditsMapbox")}</p>
        <p>{t("creditsOpenSnowMap")}</p>
        <p>{t("creditsPasses")}</p>
        <p>
          <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">
            {t("reportMapIssue")}
          </a>
        </p>
        <p>{t("creditsCode", { name: SITE_NAME })}</p>
      </section>
      <section className="card-block">
        <h2>{t("pwaTitle")}</h2>
        <p>{t("pwaBody")}</p>
        <p>{t("osm")}</p>
        <p>{t("osmLicence")}</p>
        <p>{t("opensnowmapLicence")}</p>
      </section>
      <section className="card-block">
        <h2>data/resorts.json</h2>
        <p>{t("howToUpdate")}</p>
        <p>{t("pagesSetting")}</p>
      </section>
    </div>
  );
}
