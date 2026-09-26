"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const map = pathname === "/";
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
