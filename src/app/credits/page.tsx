"use client";

import { LegalStub } from "@/components/LegalStub";
import { useApp } from "@/components/AppState";
import { SITE_NAME } from "@/lib/site";

export default function CreditsPage() {
  const { t } = useApp();
  return (
    <LegalStub titleKey="creditsTitle">
      <ul className="source-list">
        <li>{t("creditsOsm")}</li>
        <li>{t("creditsOpenSkiMap")}</li>
        <li>{t("creditsOpenSnowMap")}</li>
        <li>{t("creditsPasses")}</li>
        <li>{t("creditsCode", { name: SITE_NAME })}</li>
      </ul>
    </LegalStub>
  );
}
