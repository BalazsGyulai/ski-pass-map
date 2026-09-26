"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/components/portal/portal-api";
import portalConfig from "../../../../config/portal.json";

export default function PortalPromoPage() {
  const enabled = portalConfig.enabled || process.env.NEXT_PUBLIC_PORTAL_ENABLED === "1";
  const [me, setMe] = useState<{ csrfToken: string; resorts: string[] } | null>(null);
  const [resortId, setResortId] = useState("");
  const [text, setText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [licence, setLicence] = useState(false);
  const [status, setStatus] = useState("");
  const [existing, setExisting] = useState<{ text: string; status: string; rejection_reason?: string | null } | null>(null);
  const [resortNames, setResortNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await portalFetch("/api/portal/me");
    const json = (await res.json()) as { ok?: boolean; csrfToken?: string; resorts?: string[] };
    if (!json.ok) {
      window.location.href = "/portal/login/";
      return;
    }
    setMe({ csrfToken: json.csrfToken ?? "", resorts: json.resorts ?? [] });
    const resortsRes = await portalFetch("/api/portal/resorts");
    const resortsJson = (await resortsRes.json()) as { resorts?: Array<{ id: string; name: string }> };
    const nameMap: Record<string, string> = {};
    for (const r of resortsJson.resorts ?? []) nameMap[r.id] = r.name;
    setResortNames(nameMap);
    const id = json.resorts?.[0] ?? "";
    setResortId(id);
    if (id) {
      const promoRes = await portalFetch(`/api/portal/promo?resortId=${encodeURIComponent(id)}`);
      const promoJson = (await promoRes.json()) as { promo?: { text: string; status: string; rejection_reason?: string | null } | null };
      setExisting(promoJson.promo ?? null);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  async function submit() {
    if (!me || !licence) return;
    const res = await portalFetch(
      "/api/portal/promo",
      {
        method: "POST",
        body: JSON.stringify({
          resortId,
          text,
          linkUrl: linkUrl || null,
          logoUrl: logoUrl || null,
          ownerLicenceAccepted: true,
        }),
      },
      me.csrfToken,
    );
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setStatus(json.ok ? "Submitted for review." : `Error: ${json.error}`);
    await load();
  }

  if (!enabled) return <main className="portal-page"><p>Portal disabled.</p></main>;

  return (
    <main className="portal-page">
      <header className="portal-top">
        <h1>Resort promotion (ad)</h1>
        <Link className="portal-btn" href="/portal/">Back to dashboard</Link>
      </header>
      <div className="card-block portal-card">
        <p className="hint">One promo per resort. Labelled “Ad · From [Resort]”. Does not affect ranking.</p>
        {existing ? (
          <p>Current: <strong>{existing.status}</strong> — {existing.text}</p>
        ) : null}
        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label>
            <span>Resort</span>
            <select value={resortId} onChange={(e) => setResortId(e.target.value)}>
              {me?.resorts.map((id) => (
                <option key={id} value={id}>{resortNames[id] ?? id}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Short text (max 200)</span>
            <textarea maxLength={200} required value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <label>
            <span>Optional link (your domain)</span>
            <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          </label>
          <label>
            <span>Optional logo URL</span>
            <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </label>
          <label className="contact-checkbox">
            <input type="checkbox" checked={licence} onChange={(e) => setLicence(e.target.checked)} />
            <span>I grant the owner-content licence for this promo (Annex 1).</span>
          </label>
          <button type="submit" className="portal-btn portal-btn-primary">Submit promo</button>
        </form>
        {status ? <p className="portal-banner portal-banner--ok">{status}</p> : null}
      </div>
    </main>
  );
}
