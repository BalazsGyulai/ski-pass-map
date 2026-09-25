"use client";

import { dataset, passes, resorts } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useApp } from "./AppState";

export function AboutView() {
  const { t, lang } = useApp();
  const updated = dataset.generated;

  return (
    <div className="page page-narrow">
      <h1>{t("aboutTitle")}</h1>
      <section className="card-block">
        <h2>{t("disclaimerTitle")}</h2>
        <p>{t("disclaimer")}</p>
        <p>{t("checkOfficial")}</p>
      </section>
      <section className="card-block">
        <h2>{t("seasonLabel", { season: "2026/27" })}</h2>
        <p>{updated ? t("lastUpdated", { date: formatDate(lang, updated) }) : t("updatedUnknown")}</p>
        <p>{t("resortsInData", { n: resorts.length })}</p>
        <p>{t("passesInData", { n: passes.length })}</p>
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
                  <a href={pass.url} target="_blank" rel="noreferrer">
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
        <h2>{t("pwaTitle")}</h2>
        <p>{t("pwaBody")}</p>
        <p>{t("osm")}</p>
      </section>
      <section className="card-block">
        <h2>data/resorts.json</h2>
        <p>{t("howToUpdate")}</p>
        <p>{t("pagesSetting")}</p>
      </section>
    </div>
  );
}
