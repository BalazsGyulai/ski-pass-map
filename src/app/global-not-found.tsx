import type { Metadata } from "next";
import { defaultLangHome } from "@/i18n/routing";
import { SITE_NAME } from "@/lib/site";
import { DocumentShell, documentViewport, redirectMetadata } from "./DocumentShell";

export const metadata: Metadata = { ...redirectMetadata, title: `Page not found · ${SITE_NAME}` };
export const viewport = documentViewport;

// Unmatched URLs render here. Each segment has its own root layout, so this page builds its own document.
export default function GlobalNotFound() {
  return (
    <DocumentShell lang="en">
      <div className="page page-narrow">
        <h1>That page is not on this map.</h1>
        <p>
          {/* A plain anchor: defaultLangHome() already includes the base path, and Link would add it again. */}
          <a href={defaultLangHome()}>Back to the map</a>
        </p>
      </div>
    </DocumentShell>
  );
}
