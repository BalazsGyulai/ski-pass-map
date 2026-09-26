"use client";

import type { ReactNode } from "react";
import type { MessageKey } from "@/lib/i18n";
import { useApp } from "./AppState";

export function LegalStub({ titleKey, children }: { titleKey: MessageKey; children?: ReactNode }) {
  const { t } = useApp();
  return (
    <div className="page page-narrow">
      <p className="todo-banner">{t("legalTodo")}</p>
      <h1>{t(titleKey)}</h1>
      {titleKey === "supportSkimap" ? <p>{t("supportBody")}</p> : null}
      <p className="disclaimer">{t("globalDisclaimer")}</p>
      {children}
    </div>
  );
}
