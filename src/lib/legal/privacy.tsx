import type { ReactNode } from "react";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function RetentionTableEn() {
  return (
    <table className="legal-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Data</th>
          <th>Retention</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Contact – wrong data</td>
          <td>Message, optional email, resort id</td>
          <td>Resolution + 12 months</td>
        </tr>
        <tr>
          <td>Contact – legal notice</td>
          <td>Message, optional email</td>
          <td>5 years after closure</td>
        </tr>
        <tr>
          <td>Contact – resort owner</td>
          <td>Message, email</td>
          <td>Relationship + 5 years</td>
        </tr>
        <tr>
          <td>Contact – other / privacy</td>
          <td>Message, optional email</td>
          <td>12 months</td>
        </tr>
        <tr>
          <td>Support perk code</td>
          <td>Code hash + expiry in D1 (no donor email stored)</td>
          <td>Until expiry (max 30 days)</td>
        </tr>
        <tr>
          <td>Support prompt UX</td>
          <td>UTC date + daily count in localStorage</td>
          <td>Until cleared by you</td>
        </tr>
        <tr>
          <td>Map load budget</td>
          <td>Hashed IP bucket, monthly Mapbox counter</td>
          <td>10 minutes / calendar month</td>
        </tr>
        <tr>
          <td>Aggregate stats (optional)</td>
          <td>UTC day + path, hit count</td>
          <td>14 months (rolling)</td>
        </tr>
        <tr>
          <td>Portal accounts</td>
          <td>Email, passkey credentials, resort linkage</td>
          <td>While account active + audit logs per policy</td>
        </tr>
        <tr>
          <td>Portal audit log</td>
          <td>Actor, action, entity, timestamp</td>
          <td>5 years</td>
        </tr>
      </tbody>
    </table>
  );
}

export function PrivacyEn() {
  return (
    <>
      <Block title="Controller">
        <p>Balázs Gyulai, [SEAT], [EMAIL].</p>
      </Block>
      <Block title="What we process">
        <ul>
          <li>Hosting logs (IP, URL, user agent) at Cloudflare — legitimate interest / security.</li>
          <li>Contact form messages stored in Cloudflare D1 (EU jurisdiction).</li>
          <li>Turnstile bot check (Cloudflare) — strictly necessary, no marketing cookies.</li>
          <li>Device storage: favourites, trip plan, language, theme, map consent, support-prompt counters, optional reward quiet period.</li>
          <li>Optional Mapbox map (only after consent): Mapbox may process technical data; see Mapbox privacy policy.</li>
          <li>OpenFreeMap / OpenStreetMap tile requests: your IP is visible to those operators.</li>
          <li>Ko-fi / payment processors are independent controllers for donations; we receive only a webhook to generate a perk code (no name, email or message stored).</li>
          <li>Resort portal: account email, WebAuthn credentials, edits, promos, audit entries.</li>
          <li>Optional Cloudflare Web Analytics beacon (cookieless) when enabled.</li>
        </ul>
      </Block>
      <Block title="Processors">
        <p>
          Cloudflare (Pages, D1, Turnstile, Workers AI for admin checks), mailbox provider for routed email [MAILBOX], Mapbox (optional map), Ko-fi (donations, independent controller).
        </p>
      </Block>
      <Block title="Transfers">
        <p>US transfers rely on the EU–US Data Privacy Framework and/or Standard Contractual Clauses where applicable (Cloudflare, Mapbox, Ko-fi).</p>
      </Block>
      <Block title="Retention">
        <RetentionTableEn />
      </Block>
      <Block title="Your rights">
        <p>
          Access, rectification, erasure, restriction, portability, objection. Contact [EMAIL]. You may lodge a complaint with the Hungarian National Authority for Data Protection and Freedom of Information (NAIH),{" "}
          <a href="https://www.naih.hu" rel="noopener noreferrer">naih.hu</a>.
        </p>
      </Block>
    </>
  );
}

export function PrivacyHu() {
  return (
    <>
      <Block title="Adatkezelő">
        <p>Gyulai Balázs, [SEAT], [EMAIL].</p>
      </Block>
      <Block title="Kezelt adatok">
        <ul>
          <li>Tárhely naplók (IP, URL) — Cloudflare.</li>
          <li>Kapcsolatfelvételi üzenetek — D1 (EU).</li>
          <li>Turnstile — szükséges biztonsági ellenőrzés.</li>
          <li>Eszközön tárolt adatok: kedvencek, terv, nyelv, téma, térkép-hozzájárulás, támogatási számlálók.</li>
          <li>Opcionális Mapbox térkép hozzájárulás után.</li>
          <li>Ko-fi / fizetési szolgáltatók önálló adatkezelők; webhookból csak kód-hash és lejárat kerül tárolásra.</li>
          <li>Portál fiókok, szerkesztések, audit napló.</li>
          <li>Opcionális, süti nélküli Cloudflare Web Analytics.</li>
        </ul>
      </Block>
      <Block title="Adatfeldolgozók">
        <p>Cloudflare (Pages, D1, Turnstile, Workers AI), levelező szolgáltató [MAILBOX], Mapbox (opcionális), Ko-fi.</p>
      </Block>
      <Block title="Továbbítás">
        <p>USA: megfelelőségi mechanizmusok (DPF / SCC).</p>
      </Block>
      <Block title="Megőrzés">
        <RetentionTableEn />
      </Block>
      <Block title="Érintetti jogok">
        <p>
          Hozzáférés, helyesbítés, törlés, korlátozás, hordozhatóság, tiltakozás — [EMAIL]. Panasz: Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH),{" "}
          <a href="https://www.naih.hu" rel="noopener noreferrer">naih.hu</a>.
        </p>
      </Block>
    </>
  );
}
