"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/site";
import { fieldTierLabel } from "@/lib/portal/tier-fields";
import portalConfig from "../../../config/portal.json";

type Me = { email: string; resorts: string[]; csrfToken: string };

async function portalApi(path: string, init?: RequestInit, csrf?: string) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  if (csrf) headers.set("x-csrf-token", csrf);
  if (process.env.NEXT_PUBLIC_PORTAL_DEV_EMAIL) {
    headers.set("x-portal-dev-email", process.env.NEXT_PUBLIC_PORTAL_DEV_EMAIL);
  }
  const url = new URL(`${BASE_PATH}${path}`, window.location.origin).href;
  return fetch(url, { ...init, headers, credentials: "include" });
}

export default function PortalPage() {
  const enabled = portalConfig.enabled || process.env.NEXT_PUBLIC_PORTAL_ENABLED === "1";
  const [me, setMe] = useState<Me | null>(null);
  const [edits, setEdits] = useState<unknown[]>([]);
  const [lang, setLang] = useState<"de" | "en">("de");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const res = await portalApi("/api/portal/me");
    const json = (await res.json()) as { ok?: boolean; email?: string; resorts?: string[]; csrfToken?: string };
    if (json.ok && json.email) setMe({ email: json.email, resorts: json.resorts ?? [], csrfToken: json.csrfToken ?? "" });
    else setMe(null);
    const editsRes = await portalApi("/api/portal/edits");
    const editsJson = (await editsRes.json()) as { edits?: unknown[] };
    setEdits(editsJson.edits ?? []);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  async function devLogin() {
    await portalApi("/api/portal/dev-login", { method: "POST", body: "{}" });
    await load();
  }

  async function submitSampleEdit() {
    if (!me?.resorts[0]) return;
    const resortId = me.resorts[0];
    const body = {
      entityType: "resort",
      entityId: resortId,
      sourceUrl: `${window.location.origin}/fixtures/source.html`,
      changes: [{ path: "seasonDates.value", before: "2025/26", after: "2026/27", kind: "date" }],
      before: { seasonDates: { value: "2025/26" } },
      after: { seasonDates: { value: "2026/27" } },
    };
    const res = await portalApi("/api/portal/edits", { method: "POST", body: JSON.stringify(body) }, me.csrfToken);
    const json = (await res.json()) as { ok?: boolean; status?: string };
    setStatus(json.ok ? `Submitted (${json.status})` : "Submit failed");
    await load();
  }

  if (!enabled) {
    return (
      <main className="portal-page">
        <h1>{lang === "de" ? "Resort-Portal" : "Resort portal"}</h1>
        <p>{lang === "de" ? "Das Portal ist derzeit deaktiviert." : "The portal is currently disabled."}</p>
        <p>
          <Link href="/de/for-resorts/">{lang === "de" ? "Informationen für Skigebiete" : "For resorts"}</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="portal-page">
      <header className="portal-header">
        <h1>{lang === "de" ? "Resort-Portal" : "Resort portal"}</h1>
        <div className="portal-lang">
          <button type="button" className={lang === "de" ? "active" : ""} onClick={() => setLang("de")}>DE</button>
          <button type="button" className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
      </header>
      {!me ? (
        <section>
          <p>{lang === "de" ? "Melden Sie sich mit Ihrem Passkey an." : "Sign in with your passkey."}</p>
          <button type="button" className="btn-primary" onClick={devLogin}>
            {lang === "de" ? "Entwickler-Anmeldung (lokal)" : "Dev login (local)"}
          </button>
        </section>
      ) : (
        <section>
          <p>{me.email}</p>
          <h2>{lang === "de" ? "Ihre Skigebiete" : "Your resorts"}</h2>
          <ul>
            {me.resorts.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <h2>{lang === "de" ? "Bearbeiten (Beispiel)" : "Edit (sample)"}</h2>
          <p className="hint">
            {lang === "de" ? "Feldebene:" : "Field tier:"} seasonDates → {fieldTierLabel("seasonDates")}
          </p>
          <button type="button" onClick={submitSampleEdit}>{lang === "de" ? "Teständerung senden" : "Submit test change"}</button>
          {status ? <p>{status}</p> : null}
          <h2>{lang === "de" ? "Einreichungen" : "Submissions"}</h2>
          <pre>{JSON.stringify(edits, null, 2)}</pre>
          <button
            type="button"
            onClick={async () => {
              const blob = new Blob([JSON.stringify({ me, edits }, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "portal-export.json";
              a.click();
            }}
          >
            {lang === "de" ? "JSON exportieren" : "Export JSON"}
          </button>
        </section>
      )}
    </main>
  );
}
