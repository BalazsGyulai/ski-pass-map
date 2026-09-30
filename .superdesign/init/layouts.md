# Layouts

The public site is `DocumentShell` → `[lang]/layout` → `Chrome` → the page. The map page (`/`) replaces the desktop header with the bar inside `ExplorerFrame`. Phone width is below 900px (`useNarrow`).

## DocumentShell

HTML shell: Inter font, theme bootstrap, CSP meta.

- Path: `src/app/DocumentShell.tsx`

### `src/app/DocumentShell.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { META_CONTENT_SECURITY_POLICY, REFERRER_POLICY } from "@/lib/security";
import { BASE_PATH, SITE_NAME, SITE_ORIGIN } from "@/lib/site";
import "./globals.css";

// The optical-size axis gives headings Inter Display's tighter cut and keeps small text open.
const inter = Inter({ subsets: ["latin", "latin-ext"], axes: ["opsz"], display: "swap" });

export const documentViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
  ],
};

export const documentMetadataBase = new URL(SITE_ORIGIN);

export const redirectMetadata: Metadata = {
  metadataBase: documentMetadataBase,
  title: SITE_NAME,
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  referrer: REFERRER_POLICY,
  appleWebApp: { capable: true, title: SITE_NAME },
  icons: {
    icon: `${BASE_PATH}/icon-192.png`,
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
};

const themeScript = `try{var t=localStorage.getItem("ski-pass-map-v1");if(t){var p=JSON.parse(t);if(p.theme==="light"||p.theme==="dark")document.documentElement.dataset.theme=p.theme;}var l=localStorage.getItem("skimap-lang");if(l)document.documentElement.lang=l;}catch(e){}`;

export function DocumentShell({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={META_CONTENT_SECURITY_POLICY} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
```

## layout

Language layout: AppProvider, Chrome, service worker.

- Path: `src/app/[lang]/layout.tsx`

### `src/app/[lang]/layout.tsx`

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Lang } from "@/i18n/languages";
import { LANGS, isLang } from "@/i18n/languages";
import { loadMessages } from "@/i18n/load-messages";
import { buildRootLayoutMetadata } from "@/i18n/metadata";
import { AppProvider } from "@/components/AppState";
import { Chrome } from "@/components/Chrome";
import { ServiceWorker } from "@/components/ServiceWorker";
import { DocumentShell, documentViewport } from "../DocumentShell";

export const viewport = documentViewport;

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  return buildRootLayoutMetadata(raw);
}

export default async function LangRootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const messages = await loadMessages(lang);
  return (
    <DocumentShell lang={lang}>
      <AppProvider lang={lang} messages={messages}>
        <Chrome>{children}</Chrome>
        <ServiceWorker />
      </AppProvider>
    </DocumentShell>
  );
}
```

## Chrome

App shell. Desktop header, phone top bar and tab bar, footer, toasts, overlays.

- Path: `src/components/Chrome.tsx`

### `src/components/Chrome.tsx`

```tsx
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isMapPath, isTabShellPath } from "@/i18n/routing";
import { BottomTabBar } from "./BottomTabBar";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { MobileTopBar } from "./MobileTopBar";
import { SiteOverlays } from "./SiteOverlays";
import { ToastHost } from "./Toast";
import { useApp } from "./AppState";
import { useNarrow } from "./useNarrow";

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { lang } = useApp();
  const narrow = useNarrow();
  const map = isMapPath(pathname, lang);
  const tabShell = isTabShellPath(pathname, lang);
  const showMobileTabs = narrow && tabShell;
  const showDesktopHeader = !map && (!narrow || !tabShell);
  const showFooter = showDesktopHeader && !tabShell;
  return (
    <div className={`site ${map ? "site-map" : ""} ${showMobileTabs ? "site-tabs" : ""}`}>
      {showDesktopHeader ? <Header /> : null}
      {showMobileTabs && !map ? <MobileTopBar /> : null}
      <main id="main" className={`site-main ${map ? "explorer-main" : ""}`}>
        {children}
      </main>
      {showFooter ? <Footer /> : null}
      {showMobileTabs ? <BottomTabBar /> : null}
      <ToastHost />
      {/* Inside .site so the consent and support cards can sit above the tab bar. */}
      <SiteOverlays />
    </div>
  );
}
```

## Header

Desktop bar on non-map pages: brand, Map / Passes / Plan, language, settings.

- Path: `src/components/Header.tsx`

### `src/components/Header.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";
import { useApp } from "./AppState";
import { isCurrentTab, primaryTabs } from "./nav-links";

/** The map's desktop bar, without the search field. Map sits left of Passes. */
export function Header() {
  const pathname = usePathname();
  const { t, resortDays } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(pathname);
  const days = Object.values(resortDays).reduce((sum, value) => sum + value, 0);
  return (
    <header className="site-header">
      <a className="skip" href="#main">
        {t("skip")}
      </a>
      <div className="topbar">
        <Link href={href("/")} className="brand desk-brand">
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="topbar-links" aria-label={t("title")}>
          {primaryTabs.map((link) => (
            <Link key={link.rest} href={href(link.rest)} aria-current={isCurrentTab(rest, link.rest) ? "page" : undefined}>
              {link.rest === "/plan" && days > 0 ? t("myPlanPillPlain", { days }) : t(link.key)}
            </Link>
          ))}
          <LanguageSwitcher compact />
          <SettingsLink className="icon-btn" />
        </nav>
      </div>
    </header>
  );
}
```

## MobileTopBar

Phone bar on tab pages that are not the map.

- Path: `src/components/MobileTopBar.tsx`

### `src/components/MobileTopBar.tsx`

```tsx
"use client";

import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { SettingsLink } from "./SettingsLink";

/** Slim bar above the tab pages on phones: the name, language, and the gear for Settings. */
export function MobileTopBar() {
  const href = useLocalizedPath();
  return (
    <header className="mobile-top">
      <Link href={href("/")} className="brand">
        <span>{SITE_NAME}</span>
      </Link>
      <div className="bar-tools">
        <LanguageSwitcher compact />
        <SettingsLink className="icon-btn" />
      </div>
    </header>
  );
}
```

## BottomTabBar

Phone tab bar: Map, Passes, Plan. Plan shows a day-count badge.

- Path: `src/components/BottomTabBar.tsx`

### `src/components/BottomTabBar.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { parseLangPath } from "@/i18n/routing";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";
import { isCurrentTab, primaryTabs } from "./nav-links";

export function BottomTabBar() {
  const pathname = usePathname();
  const { t, resortDays } = useApp();
  const href = useLocalizedPath();
  const { rest } = parseLangPath(pathname);
  const days = Object.values(resortDays).reduce((sum, value) => sum + value, 0);
  return (
    <nav className="bottom-tab-bar" aria-label={t("title")}>
      {primaryTabs.map((tab) => {
        const current = isCurrentTab(rest, tab.rest);
        return (
          <Link key={tab.rest} href={href(tab.rest)} className={current ? "is-current" : undefined} aria-current={current ? "page" : undefined}>
            <span className="tab-icon">
              <tab.Icon />
              {tab.rest === "/plan" && days > 0 ? (
                <span className="tab-badge num" aria-hidden="true">
                  {days}
                </span>
              ) : null}
            </span>
            <span>{t(tab.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

## Footer

Legal links and the cookie-settings button. Desktop, non-tab pages.

- Path: `src/components/Footer.tsx`

### `src/components/Footer.tsx`

```tsx
"use client";

import Link from "next/link";
import { legalLinks } from "./legal-links";
import { useLocalizedPath } from "./LanguageSwitcher";
import { useApp } from "./AppState";

export function Footer() {
  const { t, openCookieSettings } = useApp();
  const href = useLocalizedPath();
  return (
    <footer className="site-footer">
      <nav aria-label={t("siteFooter")}>
        {legalLinks.map((link) => (
          <Link key={link.rest} href={href(link.rest)}>
            {t(link.key)}
          </Link>
        ))}
        <button type="button" className="linkish footer-cookie" onClick={() => openCookieSettings()}>
          {t("cookieSettings")}
        </button>
      </nav>
      <p className="disclaimer">{t("globalDisclaimer")}</p>
    </footer>
  );
}
```

## ExplorerFrame

Map page shell: search pill, map stage, bottom sheet, filters.

- Path: `src/components/ExplorerFrame.tsx`

### `src/components/ExplorerFrame.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { resortById } from "@/lib/data";
import { SITE_NAME } from "@/lib/site";
import { nextSheetSnap, type SheetSnap } from "@/lib/sheet";
import { FilterSheet } from "./FilterSheet";
import { LayersPanel, MapTools } from "./MapTools";
import { ListSheet } from "./ListSheet";
import { LanguageSwitcher, useLocalizedPath } from "./LanguageSwitcher";
import { PassChips } from "./PassChips";
import { PlanPill } from "./PlanPill";
import { ResortCard } from "./ResortCard";
import { SearchPill } from "./SearchPill";
import { SettingsLink } from "./SettingsLink";
import { SkiMap } from "./map/SkiMap";
import { useApp } from "./AppState";
import { useNarrow } from "./useNarrow";

export function ExplorerFrame() {
  const { share, selectResort, t, offline, areaStale, searchThisArea, resortDays, copyLink } = useApp();
  const href = useLocalizedPath();
  const narrow = useNarrow();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [listSnap, setListSnap] = useState<SheetSnap>("peek");
  const [cardSnap, setCardSnap] = useState<SheetSnap>("half");
  const resort = share.resort ? resortById.get(share.resort) : undefined;
  const snap = resort ? cardSnap : listSnap;
  const days = Object.values(resortDays).reduce((sum, value) => sum + value, 0);
  const previousResort = useRef<string | null>(null);

  useEffect(() => {
    setCardSnap("half");
  }, [share.resort]);

  useEffect(() => {
    document.documentElement.dataset.sheet = snap;
    document.documentElement.dataset.panel = resort ? "resort" : "list";
    return () => {
      delete document.documentElement.dataset.sheet;
      delete document.documentElement.dataset.panel;
    };
  }, [snap, resort]);

  useEffect(() => {
    const previous = previousResort.current;
    if (previous && !share.resort) {
      const row = document.getElementById(`resort-${previous}`)?.querySelector("button");
      row?.focus();
    }
    previousResort.current = share.resort;
  }, [share.resort]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select"));
      if (event.key === "Escape") {
        if (layersOpen) setLayersOpen(false);
        else if (filtersOpen) setFiltersOpen(false);
        else if (share.resort) selectResort(null);
        else {
          const next = nextSheetSnap(listSnap, "down");
          if (next !== listSnap) setListSnap(next);
        }
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setFiltersOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen, layersOpen, listSnap, selectResort, share.resort]);

  const compact = narrow && resort && cardSnap === "full" ? { name: resort.name, onBack: () => setCardSnap("half") } : null;

  return (
    <div className="explorer" data-snap={snap} data-panel={resort ? "resort" : "list"}>
      <a className="skip" href="#sheet-host">
        {t("skip")}
      </a>
      {offline ? <p className="offline-banner">{t("offline")}</p> : null}
      <header className="topbar">
        <Link href={href("/")} className="brand desk-brand">
          <span>{SITE_NAME}</span>
        </Link>
        <SearchPill onOpen={() => setFiltersOpen(true)} compact={compact} onShare={copyLink} />
        <nav className="topbar-links" aria-label={t("title")}>
          <Link href={href("/passes")}>{t("passes")}</Link>
          <Link href={href("/plan")}>{days > 0 ? t("myPlanPillPlain", { days }) : t("myPlanLink")}</Link>
          <LanguageSwitcher compact />
          <SettingsLink className="icon-btn" />
        </nav>
        <SettingsLink className="tool-btn topbar-gear" />
      </header>
      <div className="stage">
        <SkiMap />
        <PassChips />
        <MapTools layersOpen={layersOpen} onLayers={() => setLayersOpen((open) => !open)} />
        <LayersPanel open={layersOpen} onClose={() => setLayersOpen(false)} />
        {areaStale && !resort ? (
          <button type="button" className="area-btn" onClick={searchThisArea}>
            {t("searchThisArea")}
          </button>
        ) : null}
        <PlanPill />
      </div>
      <div className="sheet-host" id="sheet-host">
        {resort ? <ResortCard snap={cardSnap} setSnap={setCardSnap} /> : <ListSheet snap={listSnap} setSnap={setListSnap} />}
      </div>
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </div>
  );
}
```

