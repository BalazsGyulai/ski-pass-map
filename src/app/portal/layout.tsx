import type { Metadata } from "next";
import { DocumentShell, documentViewport } from "../DocumentShell";
import { readPortalConfig } from "@/lib/portal/config";

export const viewport = documentViewport;

export const metadata: Metadata = {
  title: "Resort portal",
  robots: readPortalConfig().enabled ? { index: false, follow: false } : { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocumentShell lang="en">
      <div className="portal-shell">{children}</div>
    </DocumentShell>
  );
}
