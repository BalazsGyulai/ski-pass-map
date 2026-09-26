"use client";

import { useCallback, useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/site";

type Message = {
  id: string;
  created_at: number;
  category: string;
  status: string;
  message: string;
  resort_id: string | null;
};

type Edit = {
  id: string;
  entity_type: string;
  entity_id: string;
  status: string;
  tier: string;
  source_url: string;
  checker_result_json: string | null;
};

type Tab = "inbox" | "edits" | "portal" | "audit";

type PortalQueue = {
  postModeration: Edit[];
  reviewB: Edit[];
  reviewC: Edit[];
  promos: unknown[];
};

async function api(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  const devEmail = process.env.NEXT_PUBLIC_ADMIN_DEV_EMAIL;
  if (devEmail) headers.set("x-admin-dev-email", devEmail);
  const url = new URL(`${BASE_PATH}${path}`, window.location.origin).href;
  return fetch(url, { ...init, headers });
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const [checkerPreview, setCheckerPreview] = useState<string>("");
  const [portalQueue, setPortalQueue] = useState<PortalQueue | null>(null);
  const [inviteLink, setInviteLink] = useState<string>("");
  const [error, setError] = useState<string>("");

  const loadInbox = useCallback(async () => {
    const res = await api("/api/admin/messages");
    const json = (await res.json()) as { ok?: boolean; messages?: Message[] };
    if (json.ok && json.messages) setMessages(json.messages);
    else setError("Could not load inbox");
  }, []);

  const loadEdits = useCallback(async () => {
    const res = await api("/api/admin/edits");
    const json = (await res.json()) as { ok?: boolean; edits?: Edit[] };
    if (json.ok && json.edits) setEdits(json.edits);
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await api("/api/admin/audit");
    const json = (await res.json()) as { ok?: boolean; audit?: unknown[] };
    if (json.ok && json.audit) setAudit(json.audit);
  }, []);

  const loadPortal = useCallback(async () => {
    const res = await api("/api/admin/portal/queue");
    const json = (await res.json()) as { ok?: boolean } & PortalQueue;
    if (json.ok) setPortalQueue(json);
  }, []);

  useEffect(() => {
    if (tab === "inbox") loadInbox();
    if (tab === "edits") loadEdits();
    if (tab === "portal") loadPortal();
    if (tab === "audit") loadAudit();
  }, [tab, loadInbox, loadEdits, loadPortal, loadAudit]);

  async function setStatus(id: string, status: string) {
    await api("/api/admin/messages", { method: "PATCH", body: JSON.stringify({ id, status }) });
    await loadInbox();
  }

  async function createSampleEdit() {
    const body = {
      entityType: "resort",
      entityId: "skimap-12357",
      sourceUrl: `${window.location.origin}/fixtures/source.html`,
      changes: [{ path: "dayTicket.value.eur", before: 50, after: 59, kind: "price" }],
      before: { dayTicket: { value: { eur: 50 } } },
      after: { dayTicket: { value: { eur: 59 } } },
    };
    const res = await api("/api/admin/edits", { method: "POST", body: JSON.stringify(body) });
    const json = (await res.json()) as { ok?: boolean; id?: string };
    if (json.ok && json.id) {
      const check = await api("/api/admin/check", {
        method: "POST",
        body: JSON.stringify({
          sourceUrl: body.sourceUrl,
          changes: body.changes,
          editId: json.id,
        }),
      });
      const checkJson = (await check.json()) as { result?: unknown };
      setCheckerPreview(JSON.stringify(checkJson.result ?? checkJson, null, 2));
      await loadEdits();
    }
  }

  async function approveEdit(id: string) {
    await api(`/api/admin/edits/${id}/approve`, { method: "POST", body: "{}" });
    await loadEdits();
  }

  async function createInvite() {
    const res = await api("/api/admin/portal/invites", {
      method: "POST",
      body: JSON.stringify({ email: "info@example.com", resortIds: ["skimap-12357"] }),
    });
    const json = (await res.json()) as { inviteUrl?: string; warnings?: string[] };
    if (json.inviteUrl) setInviteLink(json.inviteUrl);
    await loadPortal();
  }

  async function rollbackEdit(editId: string) {
    const reason = "Rollback after post-moderation review: source mismatch.";
    await api("/api/admin/portal/rollback", { method: "POST", body: JSON.stringify({ editId, reason }) });
    await loadPortal();
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>Skimap admin</h1>
        <p className="admin-note">English only. Protected by Cloudflare Access in production.</p>
        <nav className="admin-tabs" aria-label="Admin sections">
          <button type="button" className={tab === "inbox" ? "active" : ""} onClick={() => setTab("inbox")}>Inbox</button>
          <button type="button" className={tab === "edits" ? "active" : ""} onClick={() => setTab("edits")}>Edit queue</button>
          <button type="button" className={tab === "portal" ? "active" : ""} onClick={() => setTab("portal")}>Portal</button>
          <button type="button" className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>Audit log</button>
        </nav>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {tab === "inbox" ? (
        <section className="admin-inbox">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Category</th>
                <th>Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className={m.status === "flagged" ? "flagged" : ""}>
                  <td>{m.status}</td>
                  <td>{m.category}</td>
                  <td>{m.message.slice(0, 120)}</td>
                  <td>
                    <button type="button" onClick={() => setStatus(m.id, "done")}>Done</button>
                    <button type="button" onClick={() => setStatus(m.id, "flagged")}>Flag</button>
                    <button type="button" onClick={() => setStatus(m.id, "spam")}>Spam</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      {tab === "edits" ? (
        <section className="admin-edits">
          <button type="button" className="btn-primary" onClick={createSampleEdit}>Create test edit &amp; run checker</button>
          <ul>
            {edits.map((e) => (
              <li key={e.id}>
                <strong>{e.entity_type}</strong> {e.entity_id} — tier {e.tier}, {e.status}
                <button type="button" onClick={() => approveEdit(e.id)}>Approve</button>
              </li>
            ))}
          </ul>
          {checkerPreview ? <pre className="checker-result">{checkerPreview}</pre> : null}
        </section>
      ) : null}
      {tab === "portal" ? (
        <section className="admin-portal">
          <button type="button" className="btn-primary" onClick={createInvite}>Create sample invite</button>
          {inviteLink ? <p className="hint">Invite path: {inviteLink}</p> : null}
          <h2>Tier A post-moderation</h2>
          <ul>
            {(portalQueue?.postModeration ?? []).map((e) => (
              <li key={e.id}>
                {e.entity_id} — {e.status}
                <button type="button" onClick={() => rollbackEdit(e.id)}>Rollback</button>
              </li>
            ))}
          </ul>
          <h2>Tier B / C review</h2>
          <pre>{JSON.stringify({ b: portalQueue?.reviewB, c: portalQueue?.reviewC, promos: portalQueue?.promos }, null, 2)}</pre>
        </section>
      ) : null}
      {tab === "audit" ? (
        <section>
          <pre>{JSON.stringify(audit, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}
