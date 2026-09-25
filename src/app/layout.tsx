import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppProvider } from "@/components/AppState";
import { Header } from "@/components/Header";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Ski pass map 2026/27",
    template: "%s · Ski pass map",
  },
  description: "Season passes for ski resorts in eastern Austria, 2026/27. Compare coverage, prices, and straight-line distance from home.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Ski passes" },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c6b52",
};

const themeScript = `try{var t=localStorage.getItem("ski-pass-map-v1");if(t){var p=JSON.parse(t);if(p.theme==="light"||p.theme==="dark")document.documentElement.dataset.theme=p.theme;if(p.lang==="hu"||p.lang==="en")document.documentElement.lang=p.lang;}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Suspense fallback={<div className="boot">Loading…</div>}>
          <AppProvider>
            <div className="site">
              <Header />
              <main id="main" className="site-main">
                {children}
              </main>
              <ServiceWorker />
            </div>
          </AppProvider>
        </Suspense>
      </body>
    </html>
  );
}
