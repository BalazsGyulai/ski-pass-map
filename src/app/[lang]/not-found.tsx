"use client";

import Link from "next/link";
import { useApp } from "@/components/AppState";
import { useLocalizedPath } from "@/components/LanguageSwitcher";

export default function LangNotFound() {
  const { t } = useApp();
  const href = useLocalizedPath();
  return (
    <div className="page page-narrow">
      <h1>{t("notFound")}</h1>
      <p>
        <Link href={href("/")}>{t("backHome")}</Link>
      </p>
    </div>
  );
}
