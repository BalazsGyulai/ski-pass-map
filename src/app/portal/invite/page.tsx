"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/site";
import portalConfig from "../../../../config/portal.json";

export default function PortalInvitePage() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [info, setInfo] = useState<{ email: string; resortIds: string[]; termsVersion: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [liability, setLiability] = useState(false);
  const enabled = portalConfig.enabled || process.env.NEXT_PUBLIC_PORTAL_ENABLED === "1";

  useEffect(() => {
    if (!enabled || !token) return;
    const url = new URL(`${BASE_PATH}/api/portal/invite`, window.location.origin);
    url.searchParams.set("token", token);
    fetch(url.href)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setInfo({ email: json.email, resortIds: json.resortIds, termsVersion: json.termsVersion });
      })
      .catch(() => undefined);
  }, [enabled, token]);

  if (!enabled) {
    return (
      <main className="portal-page">
        <p>Portal disabled.</p>
        <Link href="/en/for-resorts/">For resorts</Link>
      </main>
    );
  }

  return (
    <main className="portal-page">
      <h1>Resort portal invite</h1>
      {info ? (
        <>
          <p>Email: {info.email}</p>
          <p>Resorts: {info.resortIds.join(", ")}</p>
          <p>
            Read the{" "}
            <Link href="/en/resort-terms/">Resort Terms (DRAFT)</Link> and{" "}
            <Link href="/de/resort-terms/">Portal-Bedingungen (ENTWURF)</Link>.
          </p>
          <label>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            I accept the Resort Terms ({info.termsVersion})
          </label>
          <label>
            <input type="checkbox" checked={liability} onChange={(e) => setLiability(e.target.checked)} />
            I separately accept clause 14 (liability) and clause 6 (irrevocable data licence)
          </label>
          <p className="hint">After accepting, register a passkey using the buttons on this page (WebAuthn).</p>
          <button type="button" className="btn-primary" disabled={!accepted || !liability}>
            Continue to passkey registration
          </button>
        </>
      ) : (
        <p>Invalid or expired invite.</p>
      )}
    </main>
  );
}
