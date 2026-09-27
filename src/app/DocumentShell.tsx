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
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
