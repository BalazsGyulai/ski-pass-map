"use client";

import Link from "next/link";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import portalConfig from "../../../../config/portal.json";
import { portalFetch } from "@/components/portal/portal-api";

export default function PortalLoginPage() {
  const enabled = portalConfig.enabled || process.env.NEXT_PUBLIC_PORTAL_ENABLED === "1";
  const devBypass = process.env.NEXT_PUBLIC_PORTAL_DEV_BYPASS === "1";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function passkeyLogin() {
    setError("");
    setBusy(true);
    try {
      const optRes = await portalFetch("/api/portal/login/options", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      const optJson = (await optRes.json()) as { ok?: boolean; challengeId?: string; options?: unknown; error?: string };
      if (!optJson.ok || !optJson.challengeId || !optJson.options) {
        setError(optJson.error ?? "Login failed");
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: optJson.options as Parameters<typeof startAuthentication>[0]["optionsJSON"] });
      const verifyRes = await portalFetch("/api/portal/login/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId: optJson.challengeId, response: assertion }),
      });
      if (!verifyRes.ok) {
        setError("Passkey verification failed");
        return;
      }
      window.location.href = "/portal/";
    } catch {
      setError("Passkey was cancelled or failed");
    } finally {
      setBusy(false);
    }
  }

  async function devLogin() {
    await portalFetch("/api/portal/dev-login", { method: "POST", body: "{}" });
    window.location.href = "/portal/";
  }

  if (!enabled) {
    return (
      <main className="portal-page card-block">
        <h1>Resort portal</h1>
        <p className="hint">Portal disabled.</p>
      </main>
    );
  }

  return (
    <main className="portal-page portal-login">
      <div className="card-block portal-card portal-login-card">
        <h1>Resort portal</h1>
        <p className="hint">Sign in with the passkey registered for your resort account.</p>
        <form
          className="contact-form"
          onSubmit={(e) => {
            e.preventDefault();
            passkeyLogin();
          }}
        >
          <label>
            <span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" className="portal-btn portal-btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in with passkey"}
          </button>
        </form>
        {error ? <p className="portal-banner portal-banner--err">{error}</p> : null}
        {devBypass ? (
          <p>
            <button type="button" className="portal-btn" onClick={devLogin}>Dev login (local only)</button>
          </p>
        ) : null}
        <p className="hint">
          <Link href="/en/for-resorts/">For resorts</Link>
        </p>
      </div>
    </main>
  );
}
