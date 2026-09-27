"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PORTAL_FIELD_DEFS, buildChangesFromForm, tierHint } from "@/lib/portal/resort-edit-fields";
import portalConfig from "../../../config/portal.json";
import { portalFetch } from "./portal-api";

type Me = { email: string; resorts: string[]; csrfToken: string };
type ResortSnap = { id: string; name: string; fields: Record<string, string | number | null> };
type Submission = {
  id: string;
  createdAt: number;
  resortId: string;
  resortName: string;
  status: string;
  tier: string;
  sourceUrl: string;
  reason: string | null;
  fields: Array<{ path: string; before: unknown; after: unknown }>;
};

export function PortalApp({ initialLang = "de" }: { initialLang?: "de" | "en" }) {
  const enabled = portalConfig.enabled || process.env.NEXT_PUBLIC_PORTAL_ENABLED === "1";
  const [lang, setLang] = useState<"de" | "en">(initialLang);
  const [me, setMe] = useState<Me | null>(null);
  const [resorts, setResorts] = useState<ResortSnap[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [sourceUrl, setSourceUrl] = useState("");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => resorts.find((r) => r.id === selectedId) ?? null, [resorts, selectedId]);

  const load = useCallback(async () => {
    const res = await portalFetch("/api/portal/me");
    const json = (await res.json()) as { ok?: boolean; email?: string; resorts?: string[]; csrfToken?: string };
    if (json.ok && json.email) {
      setMe({ email: json.email, resorts: json.resorts ?? [], csrfToken: json.csrfToken ?? "" });
    } else {
      setMe(null);
      return;
    }
    const resortsRes = await portalFetch("/api/portal/resorts");
    const resortsJson = (await resortsRes.json()) as { resorts?: ResortSnap[] };
    setResorts(resortsJson.resorts ?? []);
    const editsRes = await portalFetch("/api/portal/edits");
    const editsJson = (await editsRes.json()) as { submissions?: Submission[] };
    setSubmissions(editsJson.submissions ?? []);
    if (resortsJson.resorts?.[0]) setSelectedId((cur) => cur ?? resortsJson.resorts![0].id);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const def of PORTAL_FIELD_DEFS) {
      const v = selected.fields[def.id];
      next[def.id] = v == null ? "" : String(v);
    }
    setFormValues(next);
  }, [selected]);

  async function submitEdit() {
    if (!me || !selectedId || !sourceUrl.trim()) {
      setBanner({ kind: "err", text: lang === "de" ? "Quellen-URL ist erforderlich." : "Source URL is required." });
      return;
    }
    const built = buildChangesFromForm(selectedId, formValues, sourceUrl.trim());
    if (!built) {
      setBanner({ kind: "err", text: lang === "de" ? "Keine Änderungen." : "No changes to submit." });
      return;
    }
    setSaving(true);
    const res = await portalFetch(
      "/api/portal/edits",
      {
        method: "POST",
        body: JSON.stringify({
          entityType: "resort",
          entityId: selectedId,
          sourceUrl: sourceUrl.trim(),
          changes: built.changes,
          before: built.before,
          after: built.after,
        }),
      },
      me.csrfToken,
    );
    const json = (await res.json()) as { ok?: boolean; status?: string; error?: string };
    setSaving(false);
    if (json.ok) {
      setBanner({
        kind: "ok",
        text: lang === "de" ? `Eingereicht (${json.status})` : `Submitted (${json.status})`,
      });
      await load();
    } else {
      setBanner({ kind: "err", text: json.error ?? "Error" });
    }
  }

  async function exportJson() {
    const blob = new Blob([JSON.stringify({ me, submissions, resorts }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "portal-export.json";
    a.click();
  }

  async function logout() {
    await portalFetch("/api/portal/logout", { method: "POST" }, me?.csrfToken);
    window.location.href = "/portal/login/";
  }

  if (!enabled) {
    return (
      <main className="portal-page card-block">
        <h1>{lang === "de" ? "Resort-Portal" : "Resort portal"}</h1>
        <p className="hint">{lang === "de" ? "Das Portal ist derzeit deaktiviert." : "The portal is currently disabled."}</p>
        <Link href="/en/for-resorts/">{lang === "de" ? "Informationen für Skigebiete" : "For resorts"}</Link>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="portal-page card-block">
        <p>{lang === "de" ? "Bitte melden Sie sich an." : "Please sign in."}</p>
        <Link className="portal-btn portal-btn-primary" href="/portal/login/">{lang === "de" ? "Zum Login" : "Go to login"}</Link>
      </main>
    );
  }

  return (
    <main className="portal-page">
      <header className="portal-top">
        <div>
          <h1>{lang === "de" ? "Resort-Portal" : "Resort portal"}</h1>
          <p className="hint">{me.email}</p>
        </div>
        <div className="portal-top-actions">
          <div className="portal-lang" role="group" aria-label="Language">
            <button type="button" className={lang === "de" ? "is-on" : ""} onClick={() => setLang("de")}>DE</button>
            <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <Link className="portal-btn" href="/portal/promo/">Promo</Link>
          <button type="button" className="portal-btn" onClick={exportJson}>{lang === "de" ? "JSON export" : "Export JSON"}</button>
          <button type="button" className="portal-btn" onClick={logout}>{lang === "de" ? "Abmelden" : "Log out"}</button>
        </div>
      </header>

      {banner ? <p className={`portal-banner portal-banner--${banner.kind}`}>{banner.text}</p> : null}

      <section className="portal-grid">
        <div className="card-block portal-card">
          <h2>{lang === "de" ? "Ihre Skigebiete" : "Your resorts"}</h2>
          <ul className="portal-resort-list">
            {resorts.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={r.id === selectedId ? "is-selected" : ""}
                  onClick={() => setSelectedId(r.id)}
                >
                  <strong>{r.name}</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selected ? (
          <div className="card-block portal-card portal-edit">
            <h2>{lang === "de" ? "Daten bearbeiten" : "Edit data"} — {selected.name}</h2>
            <form
              className="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                submitEdit();
              }}
            >
              {PORTAL_FIELD_DEFS.map((def) => (
                <label key={def.id}>
                  <span className="portal-field-head">
                    <span>{lang === "de" ? def.labelDe : def.labelEn}</span>
                    <span className={`portal-tier portal-tier-${def.tier.toLowerCase()}`} title={tierHint(def.tier, lang)}>
                      {def.tier} · {tierHint(def.tier, lang)}
                    </span>
                  </span>
                  <input
                    type="text"
                    value={formValues[def.id] ?? ""}
                    onChange={(e) => setFormValues((v) => ({ ...v, [def.id]: e.target.value }))}
                  />
                </label>
              ))}
              <label>
                <span>{lang === "de" ? "Quellen-URL (Pflicht)" : "Source URL (required)"}</span>
                <input type="url" required value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
              </label>
              <button type="submit" className="portal-btn portal-btn-primary" disabled={saving}>
                {saving ? (lang === "de" ? "Senden…" : "Sending…") : lang === "de" ? "Änderung einreichen" : "Submit change"}
              </button>
            </form>
          </div>
        ) : null}
      </section>

      <section className="card-block portal-card">
        <h2>{lang === "de" ? "Einreichungen" : "Submissions"}</h2>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th>{lang === "de" ? "Datum" : "Date"}</th>
                <th>{lang === "de" ? "Skigebiet" : "Resort"}</th>
                <th>{lang === "de" ? "Feld" : "Field"}</th>
                <th>{lang === "de" ? "Alt" : "Old"}</th>
                <th>{lang === "de" ? "Neu" : "New"}</th>
                <th>{lang === "de" ? "Status" : "Status"}</th>
                <th>{lang === "de" ? "Grund" : "Reason"}</th>
              </tr>
            </thead>
            <tbody>
              {submissions.flatMap((s) =>
                s.fields.map((f, idx) => (
                  <tr key={`${s.id}-${idx}`}>
                    <td>{new Date(s.createdAt).toLocaleDateString(lang === "de" ? "de-AT" : "en-GB")}</td>
                    <td>{s.resortName}</td>
                    <td>{f.path}</td>
                    <td>{String(f.before ?? "—")}</td>
                    <td>{String(f.after ?? "—")}</td>
                    <td>{s.status} ({s.tier})</td>
                    <td>{s.reason ?? "—"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
