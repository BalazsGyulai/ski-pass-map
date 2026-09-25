import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppProvider } from "@/components/AppState";
import { Header } from "@/components/Header";
import { ServiceWorker } from "@/components/ServiceWorker";
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from "@/lib/security";
import { BASE_PATH, SITE_NAME } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: `${SITE_NAME} compares season passes for ski areas, starting with Austria for 2026/27.`,
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  referrer: REFERRER_POLICY,
  appleWebApp: { capable: true, title: SITE_NAME },
  icons: {
    icon: `${BASE_PATH}/icon-192.png`,
    apple: `${BASE_PATH}/apple-touch-icon.png`,
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
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
      </head>
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
