"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isMapPath, isTabShellPath } from "@/i18n/routing";
import { BottomTabBar } from "./BottomTabBar";
import { Footer } from "./Footer";
import { Header } from "./Header";
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
      <main id="main" className={`site-main ${map ? "explorer-main" : ""}`}>
        {children}
      </main>
      {showFooter ? <Footer /> : null}
      {showMobileTabs ? <BottomTabBar /> : null}
      <ToastHost />
    </div>
  );
}
