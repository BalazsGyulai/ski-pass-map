import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { AppProvider } from "@/components/AppState";
import { Chrome } from "@/components/Chrome";
import { ServiceWorker } from "@/components/ServiceWorker";
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from "@/lib/security";
import { BASE_PATH, SITE_NAME } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

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
  themeColor: "#0F1B2D",
};

const themeScript = `try{var t=localStorage.getItem("ski-pass-map-v1");if(t){var p=JSON.parse(t);if(p.theme==="light"||p.theme==="dark")document.documentElement.dataset.theme=p.theme;if(p.lang==="hu"||p.lang==="en")document.documentElement.lang=p.lang;}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
      </head>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Suspense fallback={<div className="boot" />}>
          <AppProvider>
            <Chrome>{children}</Chrome>
            <ServiceWorker />
          </AppProvider>
        </Suspense>
      </body>
    </html>
  );
}
