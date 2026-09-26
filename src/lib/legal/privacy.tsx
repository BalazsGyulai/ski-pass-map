import type { ReactNode } from "react";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function ProcessingTable({ rows }: { rows: { activity: string; data: string; purpose: string; basis: string; retention: string; recipients: string }[] }) {
  return (
    <div className="portal-table-wrap">
      <table className="legal-table legal-processing-table">
        <thead>
          <tr>
            <th>Activity</th>
            <th>Data</th>
            <th>Purpose</th>
            <th>Legal basis (GDPR)</th>
            <th>Retention</th>
            <th>Recipients</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.activity}>
              <td>{row.activity}</td>
              <td>{row.data}</td>
              <td>{row.purpose}</td>
              <td>{row.basis}</td>
              <td>{row.retention}</td>
              <td>{row.recipients}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const enRows = [
  {
    activity: "Hosting and security logs",
    data: "IP address, URL, user agent, timestamp (server logs)",
    purpose: "Deliver the site, abuse prevention, debugging",
    basis: "Art. 6(1)(f) legitimate interest",
    retention: "Cloudflare default log retention (typically up to 30 days for HTTP logs)",
    recipients: "Cloudflare, Inc. (processor)",
  },
  {
    activity: "Contact form",
    data: "Category, message, optional email, optional resort id, language, hashed IP bucket",
    purpose: "Answer enquiries, handle corrections and legal notices",
    basis: "Art. 6(1)(f) or Art. 6(1)(b) where you request a reply",
    retention: "Wrong data: resolution + 12 months; legal notice: 5 years after closure; resort owner: relationship + 5 years; other/privacy: 12 months; spam: delete immediately",
    recipients: "Cloudflare D1 (EU jurisdiction), mailbox provider [MAILBOX]",
  },
  {
    activity: "Turnstile (bot check)",
    data: "Browser signals processed by Cloudflare",
    purpose: "Protect the contact form",
    basis: "Art. 6(1)(f); strictly necessary (ePrivacy Art. 5(3))",
    retention: "Per Cloudflare Turnstile documentation",
    recipients: "Cloudflare, Inc.",
  },
  {
    activity: "Device storage (strictly necessary)",
    data: "Favourites, trip plan, language, theme, reference places, map filters in URL, support-prompt counters",
    purpose: "Provide the service you asked for on this device",
    basis: "Art. 6(1)(b) / ePrivacy strictly necessary",
    retention: "Until you clear site data",
    recipients: "None (local only)",
  },
  {
    activity: "Optional Mapbox map",
    data: "Mapbox may store technical identifiers in the browser when you consent",
    purpose: "Load Mapbox vector tiles instead of OpenFreeMap",
    basis: "Art. 6(1)(a) consent",
    retention: "Until consent withdrawn or storage cleared",
    recipients: "Mapbox, Inc.",
  },
  {
    activity: "Map load budget counter",
    data: "Hashed IP bucket (10 min), monthly Mapbox load count (no raw IP stored)",
    purpose: "Stay within Mapbox free tier",
    basis: "Art. 6(1)(f)",
    retention: "Bucket: 10 minutes; monthly counter: current UTC month",
    recipients: "Cloudflare D1",
  },
  {
    activity: "Ko-fi perk code",
    data: "Transaction id, code hash, code plaintext for admin hand-off (no donor name, email or message stored)",
    purpose: "Honour optional supporter quiet period",
    basis: "Art. 6(1)(b) performance of perk you requested",
    retention: "Hash until expiry (max 30 days); admin copy until sent manually",
    recipients: "Cloudflare D1; Ko-fi is independent controller for payment",
  },
  {
    activity: "Support prompt UX",
    data: "UTC date + daily show count in localStorage",
    purpose: "Limit reminder frequency",
    basis: "ePrivacy strictly necessary / Art. 6(1)(f)",
    retention: "Until cleared in settings",
    recipients: "None (local)",
  },
  {
    activity: "Optional aggregate stats",
    data: "UTC day + path, hit count (no IP, no cookie id)",
    purpose: "Understand which pages are used",
    basis: "Art. 6(1)(f)",
    retention: "14 months rolling",
    recipients: "Cloudflare D1",
  },
  {
    activity: "Optional Cloudflare Web Analytics",
    data: "Cookieless beacon (page views, referrer, country)",
    purpose: "Privacy-friendly traffic measurement",
    basis: "Art. 6(1)(f) when enabled by owner",
    retention: "Per Cloudflare Web Analytics policy",
    recipients: "Cloudflare, Inc.",
  },
  {
    activity: "Resort portal accounts",
    data: "Email, passkey/WebAuthn credentials, resort linkage, session tokens",
    purpose: "Self-service edits by verified resort operators",
    basis: "Art. 6(1)(b) contract / pre-contract steps",
    retention: "While account active; credentials deleted on account closure",
    recipients: "Cloudflare D1, Cloudflare Access (admin)",
  },
  {
    activity: "Portal edits, promos, audit log",
    data: "Edit payloads, source URLs, checker results, actor email, timestamps",
    purpose: "Publish resort updates, moderation, legal defence",
    basis: "Art. 6(1)(b) and Art. 6(1)(f)",
    retention: "Audit log: 5 years; pending edits until decided",
    recipients: "Cloudflare D1; Workers AI for optional checker (processor)",
  },
];

const huRows = enRows.map((r) => ({
  ...r,
  activity: r.activity,
}));

export function PrivacyEn() {
  return (
    <>
      <Block title="Controller">
        <p>
          <strong>Balázs Gyulai</strong> (sole trader / egyéni vállalkozó), seat: [SEAT], email: [EMAIL]. Contact: contact form or [EMAIL].
        </p>
        <p>We do not appoint a data protection officer (not required for this scale of processing).</p>
      </Block>
      <Block title="Processing activities">
        <ProcessingTable rows={enRows} />
      </Block>
      <Block title="Processors and independent controllers">
        <ul>
          <li><strong>Processors:</strong> Cloudflare (Pages, D1, Turnstile, Workers AI, optional Email Routing, optional Web Analytics); mailbox provider [MAILBOX]; Mapbox when you consent to Mapbox maps.</li>
          <li><strong>Independent controllers:</strong> Ko-fi, PayPal or Stripe for donations; map tile operators (OpenFreeMap, OpenStreetMap, OpenSnowMap) receive your IP when tiles load.</li>
        </ul>
      </Block>
      <Block title="International transfers">
        <p>
          Some recipients are in the United States. Transfers rely on the EU–US Data Privacy Framework where applicable, and/or Standard Contractual Clauses in Cloudflare&apos;s and Mapbox&apos;s DPAs. You may request a copy of safeguards via [EMAIL].
        </p>
      </Block>
      <Block title="Your rights">
        <p>
          You have the right of access, rectification, erasure, restriction, portability, and objection (Art. 15–21 GDPR). Where processing is based on consent (Mapbox), you may withdraw consent at any time via Cookie settings without affecting lawfulness before withdrawal.
        </p>
        <p>
          Lodge a complaint with the Hungarian National Authority for Data Protection and Freedom of Information (NAIH): 1055 Budapest, Falk Miksa utca 9-11.; post: 1363 Budapest, Pf. 912.; phone: +36 1 391 1400;{" "}
          <a href="https://www.naih.hu" rel="noopener noreferrer">www.naih.hu</a>; email: <a href="mailto:ugyfelszolgalat@naih.hu">ugyfelszolgalat@naih.hu</a>.
        </p>
      </Block>
      <Block title="Children">
        <p>The service is not directed at children under 16. Do not send us children&apos;s data without parental authority.</p>
      </Block>
    </>
  );
}

export function PrivacyHu() {
  return (
    <>
      <Block title="Adatkezelő">
        <p>
          <strong>Gyulai Balázs</strong> (egyéni vállalkozó), székhely: [SEAT], e-mail: [EMAIL]. Kapcsolat: űrlap vagy [EMAIL].
        </p>
      </Block>
      <Block title="Adatkezelési tevékenységek">
        <div className="portal-table-wrap">
          <table className="legal-table legal-processing-table">
            <thead>
              <tr>
                <th>Tevékenység</th>
                <th>Adat</th>
                <th>Cél</th>
                <th>Jogalap</th>
                <th>Megőrzés</th>
                <th>Adatfeldolgozó / címzett</th>
              </tr>
            </thead>
            <tbody>
              {huRows.map((row) => (
                <tr key={row.activity}>
                  <td>{row.activity}</td>
                  <td>{row.data}</td>
                  <td>{row.purpose}</td>
                  <td>{row.basis}</td>
                  <td>{row.retention}</td>
                  <td>{row.recipients}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">A táblázat angol megnevezései a technikai pontosság miatt maradtak; kérésre magyar összefoglalót adunk.</p>
      </Block>
      <Block title="Adatfeldolgozók és önálló adatkezelők">
        <ul>
          <li><strong>Adatfeldolgozók:</strong> Cloudflare (Pages, D1, Turnstile, Workers AI, opcionális e-mail routing, Web Analytics); levelező szolgáltató [MAILBOX]; Mapbox hozzájárulás esetén.</li>
          <li><strong>Önálló adatkezelők:</strong> Ko-fi / fizetési szolgáltatók; térképcsempe-szolgáltatók (IP a kérés során).</li>
        </ul>
      </Block>
      <Block title="Nemzetközi adattovábbítás">
        <p>USA-beli címzettek: DPF és/vagy SCC a Cloudflare és Mapbox DPA szerint. Másolat: [EMAIL].</p>
      </Block>
      <Block title="Érintetti jogok">
        <p>
          Hozzáférés, helyesbítés, törlés, korlátozás, hordozhatóság, tiltakozás (GDPR 15–21. cikk). A hozzájáruláson alapuló Mapbox-térkép bármikor visszavonható a süti beállításokban.
        </p>
        <p>
          Panasz: Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH), 1055 Budapest, Falk Miksa utca 9-11.; postacím: 1363 Budapest, Pf. 912.; tel.: +36 1 391 1400;{" "}
          <a href="https://www.naih.hu" rel="noopener noreferrer">www.naih.hu</a>; e-mail: <a href="mailto:ugyfelszolgalat@naih.hu">ugyfelszolgalat@naih.hu</a>.
        </p>
      </Block>
    </>
  );
}
