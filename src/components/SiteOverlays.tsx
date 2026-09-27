"use client";

import { useEffect, useRef, useState } from "react";
import { ConsentBanner } from "./ConsentBanner";
import { SupportPrompt } from "./SupportPrompt";
import { PageStatBeacon } from "./PageStatBeacon";
import { CloudflareBeacon } from "./CloudflareBeacon";
import { CookieSettingsOpener } from "./CookieSettingsPanel";
import { markFirstVisitDone } from "@/lib/support/storage";
import { useApp } from "./AppState";

export function SiteOverlays() {
  const { supportPromptSignal, pathname, ready } = useApp();
  const [cookieSettingsOpen, setCookieSettingsOpen] = useState(false);
  const navCount = useRef(0);

  useEffect(() => {
    const handler = () => setCookieSettingsOpen(true);
    window.addEventListener("skimap-open-cookie-settings", handler);
    return () => window.removeEventListener("skimap-open-cookie-settings", handler);
  }, []);

  useEffect(() => {
    if (!ready) return;
    navCount.current += 1;
    if (navCount.current >= 2) markFirstVisitDone(window.localStorage);
  }, [ready, pathname]);

  return (
    <>
      <ConsentBanner />
      <CookieSettingsOpener open={cookieSettingsOpen} onOpenChange={setCookieSettingsOpen} />
      <SupportPrompt signal={supportPromptSignal} />
      <PageStatBeacon />
      <CloudflareBeacon />
    </>
  );
}

export function openCookieSettings(): void {
  window.dispatchEvent(new Event("skimap-open-cookie-settings"));
}
