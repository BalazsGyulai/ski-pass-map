"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MessageKey } from "@/lib/i18n";
import { pathWithLang } from "@/i18n/routing";
import { resolveTurnstileSiteKey } from "@/lib/turnstile-public";
import { BASE_PATH } from "@/lib/site";
import { useApp } from "./AppState";

const CATEGORIES: { value: string; labelKey: MessageKey }[] = [
  { value: "general", labelKey: "contactCategoryGeneral" },
  { value: "data-error", labelKey: "contactCategoryDataError" },
  { value: "resort-owner", labelKey: "contactCategoryResortOwner" },
  { value: "privacy", labelKey: "contactCategoryPrivacy" },
  { value: "other", labelKey: "contactCategoryOther" },
];

type FormState = "idle" | "sending" | "success" | "error";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void }) => string;
      reset: (id?: string) => void;
    };
  }
}

export function ContactForm() {
  const { t, lang } = useApp();
  const [category, setCategory] = useState("general");
  const [email, setEmail] = useState("");
  const [resortId, setResortId] = useState("");
  const [message, setMessage] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [state, setState] = useState<FormState>("idle");
  const [errorKey, setErrorKey] = useState<MessageKey>("contactFailure");
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const tokenRef = useRef<string>("");
  const siteKey = resolveTurnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, process.env.NODE_ENV);

  const renderWidget = useCallback(() => {
    if (!turnstileRef.current || !window.turnstile || !siteKey) return;
    if (widgetId.current) window.turnstile.reset(widgetId.current);
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey: siteKey,
      callback: (token) => {
        tokenRef.current = token;
      },
      "error-callback": () => {
        tokenRef.current = "";
      },
    });
  }, [siteKey]);

  useEffect(() => {
    if (window.turnstile) renderWidget();
  }, [renderWidget]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!privacyAccepted) {
      setErrorKey("contactValidationError");
      setState("error");
      return;
    }
    if (!tokenRef.current) {
      setErrorKey("contactTurnstileError");
      setState("error");
      return;
    }
    setState("sending");
    try {
      const endpoint = new URL(`${BASE_PATH}/api/contact`, window.location.origin).href;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lang,
          category,
          email: email || null,
          resortId: resortId || null,
          message,
          privacyAccepted: true,
          turnstileToken: tokenRef.current,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (response.status === 429) {
        setErrorKey("contactRateLimited");
        setState("error");
        return;
      }
      if (!response.ok || !json.ok) {
        if (json.error === "turnstile_failed") setErrorKey("contactTurnstileError");
        else if (json.error === "validation") setErrorKey("contactValidationError");
        else setErrorKey("contactFailure");
        setState("error");
        return;
      }
      setState("success");
      setMessage("");
      setEmail("");
      setResortId("");
      setPrivacyAccepted(false);
      tokenRef.current = "";
      if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
    } catch {
      setErrorKey("contactFailure");
      setState("error");
    }
  }

  const privacyHref = pathWithLang(lang, "/privacy");

  return (
    <div className="page page-narrow">
      <h1>{t("contact")}</h1>
      <p>{t("contactIntro")}</p>
      {state === "success" ? <p className="contact-banner contact-banner--ok" role="status">{t("contactSuccess")}</p> : null}
      {state === "error" ? <p className="contact-banner contact-banner--err" role="alert">{t(errorKey)}</p> : null}
      <form className="contact-form" onSubmit={onSubmit}>
        <label>
          <span>{t("contactCategoryLabel")}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} required>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("contactEmailLabel")}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <span className="field-hint">{t("contactEmailHint")}</span>
        </label>
        <label>
          <span>{t("contactResortIdLabel")}</span>
          <input type="text" value={resortId} onChange={(e) => setResortId(e.target.value)} />
          <span className="field-hint">{t("contactResortIdHint")}</span>
        </label>
        <label>
          <span>{t("contactMessageLabel")}</span>
          <textarea required minLength={10} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("contactMessagePlaceholder")} />
        </label>
        <label className="contact-checkbox">
          <input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} required />
          <span>
            {t("contactPrivacyConsent")}{" "}
            <a href={privacyHref}>{t("privacy")}</a>
          </span>
        </label>
        {siteKey ? <div ref={turnstileRef} className="contact-turnstile" /> : null}
        <button type="submit" className="btn-primary" disabled={state === "sending" || !siteKey}>
          {state === "sending" ? t("contactSending") : t("contactSubmit")}
        </button>
      </form>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={renderWidget} />
    </div>
  );
}
