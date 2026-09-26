import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CONTENT_SECURITY_POLICY, REFERRER_POLICY } from "@/lib/security";
import { BASE_PATH, SITE_NAME, SITE_ORIGIN } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: SITE_NAME,
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

const themeScript = `try{var t=localStorage.getItem("ski-pass-map-v1");if(t){var p=JSON.parse(t);if(p.theme==="light"||p.theme==="dark")document.documentElement.dataset.theme=p.theme;}var l=localStorage.getItem("skimap-lang");if(l)document.documentElement.lang=l;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CONTENT_SECURITY_POLICY} />
      </head>
      <body className={inter.className}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
