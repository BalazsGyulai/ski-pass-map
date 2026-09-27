"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isConsentPending } from "@/lib/consent/pending";
import { SUPPORT_CONFIG } from "@/lib/config/support";
import {
  recordSupportPromptShown,
  shouldShowSupportPrompt,
  SUPPORT_DEV_FORCE_PARAM,
} from "@/lib/support/storage";
import { stubRewardedAds, type RewardedAdsProvider } from "@/lib/support/rewarded-ads";
import { setCodeQuietUntil, setRewardQuietDays } from "@/lib/support/storage";
import { setBottomOverlay } from "@/lib/overlay-layout";
import { BASE_PATH } from "@/lib/site";
import { useApp } from "./AppState";

let rewardedProvider: RewardedAdsProvider = stubRewardedAds;

export function setRewardedAdsProvider(provider: RewardedAdsProvider): void {
  rewardedProvider = provider;
}

export function SupportPrompt({ signal }: { signal: number }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const kofiUrl = SUPPORT_CONFIG.kofiUrl?.trim();
  const rewardedEnabled = SUPPORT_CONFIG.rewardedAdsEnabled;
  const rewardedReady = rewardedEnabled && rewardedProvider.isReady();

  const tryOpen = useCallback(() => {
    if (typeof window === "undefined") return;
    if (isConsentPending()) return;
    const ok = shouldShowSupportPrompt({
      storage: window.localStorage,
      now: Date.now(),
      dev: process.env.NODE_ENV !== "production",
      allowForceParam: process.env.NEXT_PUBLIC_SUPPORT_PROMPT_FORCE === "1",
      search: window.location.search,
      forceDevParam: true,
    });
    if (ok) {
      recordSupportPromptShown(window.localStorage);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    tryOpen();
    const onConsent = () => tryOpen();
    window.addEventListener("skimap-consent-resolved", onConsent);
    return () => window.removeEventListener("skimap-consent-resolved", onConsent);
  }, [signal, tryOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const host = el.closest(".support-prompt-host") as HTMLElement | null;
      setBottomOverlay("support", (host ?? el).getBoundingClientRect().height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      setBottomOverlay(null);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setBottomOverlay(null);
  };

  async function onRewarded() {
    const granted = await rewardedProvider.showRewarded();
    if (granted) {
      setRewardQuietDays(window.localStorage, 2);
      close();
    }
  }

  async function redeemCode() {
    const code = window.prompt(t("supportCodePrompt"));
    if (!code?.trim()) return;
    try {
      const res = await fetch(new URL(`${BASE_PATH}/api/support/redeem`, window.location.origin).href, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = (await res.json()) as { ok?: boolean; until?: number };
      if (json.ok && json.until) {
        setCodeQuietUntil(window.localStorage, json.until);
        close();
      }
    } catch {
      /* ignore */
    }
  }

  if (!open || isConsentPending()) return null;

  return (
    <div className="support-prompt-host" data-testid="support-prompt" role="presentation">
      <aside className="support-prompt" role="dialog" aria-label={t("supportPromptHeadline")}>
        <div className="support-prompt-card" ref={cardRef}>
          <p className="support-prompt-title">{t("supportPromptHeadline")}</p>
          {kofiUrl ? (
            <p className="support-prompt-line">
              <a href={kofiUrl} target="_blank" rel="noopener noreferrer" className="primary linkish">
                {t("supportPromptKofi")}
              </a>
            </p>
          ) : null}
          {rewardedReady ? (
            <p className="support-prompt-line">
              <button type="button" className="ghost" onClick={onRewarded}>{t("supportPromptRewarded")}</button>
            </p>
          ) : null}
          <p className="support-prompt-line">
            <button type="button" className="ghost" onClick={redeemCode}>{t("supportCodeEnter")}</button>
          </p>
          <button type="button" className="ghost support-prompt-dismiss" onClick={close}>{t("supportPromptNotNow")}</button>
        </div>
      </aside>
    </div>
  );
}

export { SUPPORT_DEV_FORCE_PARAM };
