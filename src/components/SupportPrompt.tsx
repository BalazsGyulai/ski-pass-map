"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { isConsentPending } from "@/lib/consent/pending";
import { SUPPORT_CONFIG } from "@/lib/config/support";
import { formatDate } from "@/lib/format";
import {
  recordSupportPromptShown,
  shouldShowSupportPrompt,
  SUPPORT_DEV_FORCE_PARAM,
} from "@/lib/support/storage";
import { stubRewardedAds, type RewardedAdsProvider } from "@/lib/support/rewarded-ads";
import { setCodeQuietUntil, setRewardQuietDays } from "@/lib/support/storage";
import { overlayClearance, setBottomOverlay } from "@/lib/overlay-layout";
import { BASE_PATH } from "@/lib/site";
import { useApp } from "./AppState";
import { IconClose, IconHeart } from "./icons";

let rewardedProvider: RewardedAdsProvider = stubRewardedAds;

export function setRewardedAdsProvider(provider: RewardedAdsProvider): void {
  rewardedProvider = provider;
}

function kofiLink(): string {
  return SUPPORT_CONFIG.kofiUrl?.trim() ?? "";
}

function rewardedReadyNow(): boolean {
  return SUPPORT_CONFIG.rewardedAdsEnabled && rewardedProvider.isReady();
}

type CodeState = "idle" | "busy" | "invalid" | "error";

/**
 * The support reminder: a small card with Ko-fi and the optional ad. It never shows on a first
 * visit, at most four times a day, and not at all while there is nothing to offer.
 */
export function SupportPrompt({ signal }: { signal: number }) {
  const { t, lang, share, ready, showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const cardRef = useRef<HTMLDivElement>(null);
  const resortOpen = useRef(false);
  const kofiUrl = kofiLink();
  const rewardedReady = rewardedReadyNow();

  const tryOpen = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isConsentPending() || resortOpen.current) return;
    const ok = shouldShowSupportPrompt({
      storage: window.localStorage,
      now: Date.now(),
      dev: process.env.NODE_ENV !== "production",
      allowForceParam: process.env.NEXT_PUBLIC_SUPPORT_PROMPT_FORCE === "1",
      search: window.location.search,
      forceDevParam: true,
      canOffer: Boolean(kofiLink()) || rewardedReadyNow(),
    });
    if (ok) {
      recordSupportPromptShown(window.localStorage);
      setCodeOpen(false);
      setCode("");
      setCodeState("idle");
      setOpen(true);
    }
  }, []);

  // An open resort card means "not now": the prompt would sit on the resort's buttons.
  useEffect(() => {
    resortOpen.current = Boolean(share.resort);
    if (share.resort) setOpen(false);
  }, [share.resort]);

  useEffect(() => {
    if (!ready) return;
    tryOpen();
    const onConsent = () => tryOpen();
    window.addEventListener("skimap-consent-resolved", onConsent);
    return () => window.removeEventListener("skimap-consent-resolved", onConsent);
  }, [signal, ready, tryOpen]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const el = cardRef.current;
    if (!el) return;
    const host = el.closest<HTMLElement>(".support-prompt-host");
    const measure = () => setBottomOverlay("support", host ? overlayClearance(host) : el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      setBottomOverlay(null);
    };
  }, [open]);

  async function onRewarded() {
    const granted = await rewardedProvider.showRewarded();
    if (granted) {
      setRewardQuietDays(window.localStorage, 2);
      close();
    }
  }

  async function redeemCode(event: FormEvent) {
    event.preventDefault();
    const value = code.trim();
    if (!value || codeState === "busy") return;
    setCodeState("busy");
    try {
      const res = await fetch(new URL(`${BASE_PATH}/api/support/redeem`, window.location.origin).href, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const json = (await res.json()) as { ok?: boolean; until?: number; error?: string };
      if (json.ok && json.until) {
        setCodeQuietUntil(window.localStorage, json.until);
        showToast(t("supportCodeThanks", { date: formatDate(lang, new Date(json.until).toISOString().slice(0, 10)) }));
        close();
        return;
      }
      setCodeState(json.error === "invalid" ? "invalid" : "error");
    } catch {
      setCodeState("error");
    }
  }

  if (!open || isConsentPending()) return null;

  return (
    <div className="support-prompt-host" data-testid="support-prompt" role="presentation">
      <aside className="support-prompt" role="dialog" aria-labelledby="support-prompt-title">
        <div className="support-prompt-card" ref={cardRef}>
          <div className="support-prompt-head">
            <span className="support-prompt-mark" aria-hidden="true">
              <IconHeart />
            </span>
            <div className="support-prompt-copy">
              <p className="support-prompt-title" id="support-prompt-title">
                {t("supportPromptHeadline")}
              </p>
              {process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ? <p className="support-prompt-perk">{t("supportPromptMapPerk")}</p> : null}
            </div>
            <button type="button" className="icon-btn support-prompt-close" aria-label={t("supportPromptNotNow")} title={t("supportPromptNotNow")} onClick={close}>
              <IconClose />
            </button>
          </div>
          {kofiUrl || rewardedReady ? (
            <div className="support-prompt-actions">
              {kofiUrl ? (
                <a href={kofiUrl} target="_blank" rel="noopener noreferrer" className="primary">
                  {t("supportPromptKofi")}
                </a>
              ) : null}
              {rewardedReady ? (
                <button type="button" className="ghost" onClick={onRewarded}>
                  {t("supportPromptRewarded")}
                </button>
              ) : null}
            </div>
          ) : null}
          {codeOpen ? (
            <form className="support-code" onSubmit={redeemCode}>
              <input
                type="text"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  if (codeState !== "busy") setCodeState("idle");
                }}
                aria-label={t("supportCodeEnter")}
                placeholder={t("supportCodePrompt")}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={64}
                autoFocus
              />
              <button type="submit" className="ghost" disabled={codeState === "busy" || !code.trim()}>
                {t("supportCodeRedeem")}
              </button>
              {codeState === "invalid" || codeState === "error" ? (
                <p className="support-code-error" role="alert">
                  {codeState === "invalid" ? t("supportCodeInvalid") : t("supportCodeError")}
                </p>
              ) : null}
            </form>
          ) : (
            <button type="button" className="support-code-link" onClick={() => setCodeOpen(true)}>
              {t("supportCodeEnter")}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

export { SUPPORT_DEV_FORCE_PARAM };
