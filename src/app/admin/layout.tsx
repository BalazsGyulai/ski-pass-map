import type { Metadata } from "next";
import { DocumentShell, documentViewport } from "../DocumentShell";

export const viewport = documentViewport;

export const metadata: Metadata = {
  title: "Skimap admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DocumentShell lang="en">
      <div className="admin-shell">{children}</div>
    </DocumentShell>
  );
}
