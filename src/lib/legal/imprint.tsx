import type { ReactNode } from "react";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ImprintEn({ contactPath }: { contactPath: string }) {
  return (
    <>
      <Block title="Service provider">
        <p>
          <strong>Balázs Gyulai</strong> (sole trader / egyéni vállalkozó)
          <br />
          Seat: [SEAT]
          <br />
          Company registration no.: [REG NO]
          <br />
          Tax number: [TAX NO]
          <br />
          Email: [EMAIL]
        </p>
        <p>A postal address or phone number is available on request.</p>
      </Block>
      <Block title="Hosting">
        <p>
          Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA — static site and serverless functions on Cloudflare Pages.
        </p>
      </Block>
      <Block title="DSA contact points (Arts 11–12)">
        <p>
          Electronic contact point for authorities and recipients: [EMAIL] and the{" "}
          <a href={contactPath}>contact form</a> (category “legal notice” where offered).
        </p>
      </Block>
      <Block title="Notice and action (Art. 16)">
        <p>
          To report illegal content or intellectual-property issues, use the contact form with a “legal notice” category or write to [EMAIL].
          Describe the URL, the issue, and your contact details. We process notices without undue delay.
        </p>
      </Block>
      <Block title="Editorial responsibility">
        <p>
          Factual listings are compiled from official sources with per-field provenance. Resort-submitted edits that auto-publish are attributed to the resort; pre-approved promos are labelled as advertising.
          We correct verified errors promptly. We are not a consumer arbitration body.
        </p>
      </Block>
      <Block title="Supervisory authorities">
        <p>
          Consumer complaints (Hungary): Hungarian Competition Authority (GVH). Data protection: NAIH (see privacy notice). For Austrian consumer matters relating to resort outreach, relevant Austrian authorities may apply to recipients in Austria.
        </p>
      </Block>
      <Block title="Liability note">
        <p>
          Mandatory consumer rights under Hungarian and EU law remain unaffected. We exclude liability for indirect damage and for third-party map tile availability to the extent permitted by law.
        </p>
      </Block>
    </>
  );
}

export function ImprintHu({ contactPath }: { contactPath: string }) {
  return (
    <>
      <Block title="Szolgáltató">
        <p>
          <strong>Gyulai Balázs</strong> (egyéni vállalkozó)
          <br />
          Székhely: [SEAT]
          <br />
          Nyilvántartási szám: [REG NO]
          <br />
          Adószám: [TAX NO]
          <br />
          E-mail: [EMAIL]
        </p>
        <p>Postai cím vagy telefonszám kérésre megadható.</p>
      </Block>
      <Block title="Tárhelyszolgáltató">
        <p>Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA — Cloudflare Pages.</p>
      </Block>
      <Block title="DSA kapcsolattartó pontok (11–12. cikk)">
        <p>
          Hatósági és érintetti kapcsolattartó: [EMAIL] és a{" "}
          <a href={contactPath}>kapcsolatfelvételi űrlap</a>.
        </p>
      </Block>
      <Block title="Bejelentés és intézkedés (16. cikk)">
        <p>
          Jogellenes tartalom vagy szerzői jogi bejelentés: [EMAIL] vagy az űrlap. Adja meg az URL-t, a problémát és elérhetőségét.
        </p>
      </Block>
      <Block title="Szerkesztői felelősség">
        <p>
          A tényszerű adatok hivatalos forrásokból, forrásmegjelöléssel. A síterep által beküldött, automatikusan közzétett adat a síterep közlése; a promóciók hirdetésként jelennek meg.
        </p>
      </Block>
      <Block title="Felelősség">
        <p>A kötelező fogyasztóvédelmi jogok érintetlenek. A közvetett kár és harmadik fél térképszolgáltatásának kiesése esetén a felelősség a jogszabályok által megengedett mértékig korlátozott.</p>
      </Block>
    </>
  );
}
