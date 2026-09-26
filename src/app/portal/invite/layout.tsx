import { Suspense } from "react";

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<main className="portal-page"><p>Loading…</p></main>}>{children}</Suspense>;
}
