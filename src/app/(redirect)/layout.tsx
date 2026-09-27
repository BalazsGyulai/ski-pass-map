import type { Metadata } from "next";
import { DocumentShell, documentViewport, redirectMetadata } from "../DocumentShell";

export const metadata: Metadata = redirectMetadata;
export const viewport = documentViewport;

export default function RedirectRootLayout({ children }: { children: React.ReactNode }) {
  return <DocumentShell lang="en">{children}</DocumentShell>;
}
