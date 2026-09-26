"use client";

import { useCallback, useEffect, useState } from "react";
import { SUPPORT_CONFIG } from "@/lib/config/support";
import {
  recordSupportPromptShown,
  shouldShowSupportPrompt,
  SUPPORT_DEV_FORCE_PARAM,
} from "@/lib/support/storage";
import { stubRewardedAds, type RewardedAdsProvider } from "@/lib/support/rewarded-ads";
import { setCodeQuietUntil, setRewardQuietDays } from "@/lib/support/storage";
import { BASE_PATH } from "@/lib/site";
import { useApp } from "./AppState";

let rewardedProvider: RewardedAdsProvider = stubRewardedAds;

export function setRewardedAdsProvider(provider: RewardedAdsProvider): void {
  rewardedProvider = provider;
}

export function SupportPrompt({ signal }: { signal: number }) {
  const { t } = useApp();
  const [open, setOpen] = useState(false);
  const kofiUrl = SUPPORT_CONFIG.kofiUrl?.trim();
  const rewardedEnabled = SUPPORT_CONFIG.rewardedAdsEnabled;
  const rewardedReady = rewardedEnabled && rewardedProvider.isReady();

  const check = useCallback(() => {
    if (typeof window === "undefined") return;
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
    check();
  }, [signal, check]);

  const close = () => setOpen(false);

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

  if (!open) return null;

  return (
    <aside className="support-prompt" data-testid="support-prompt" role="dialog" aria-label={t("supportPromptHeadline")}>
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
    </aside>
  );
}

export { SUPPORT_DEV_FORCE_PARAM };
