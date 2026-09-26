"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isMapPath } from "@/i18n/routing";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { useApp } from "./AppState";

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { lang } = useApp();
  const map = isMapPath(pathname, lang);
  return (
    <div className={map ? "site site-map" : "site"}>
      {map ? null : <Header />}
      <main id="main" className="site-main">
        {children}
      </main>
      {map ? null : <Footer />}
    </div>
  );
}
