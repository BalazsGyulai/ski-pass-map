"use client";

import Link from "next/link";
import { defaultLangHome } from "@/i18n/routing";
import { useApp } from "@/components/AppState";

export default function LangNotFound() {
  const { t } = useApp();
  return (
    <div className="page page-narrow">
      <h1>{t("notFound")}</h1>
      <p>
        <Link href={defaultLangHome()}>{t("backHome")}</Link>
      </p>
    </div>
  );
}
