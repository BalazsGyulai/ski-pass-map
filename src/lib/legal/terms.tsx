import type { ReactNode } from "react";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-block">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function TermsEn({ rankingPath }: { rankingPath: string }) {
  return (
    <>
      <Block title="Use of the service">
        <p>Skimap.eu is a free information service about ski passes and resorts. No account is required for the public map.</p>
      </Block>
      <Block title="Accuracy disclaimer">
        <p>
          Prices, opening dates, lift counts and coverage may be wrong or outdated. Always check each resort&apos;s or pass operator&apos;s official website before you travel or buy.
          We do not guarantee completeness or accuracy. Liability is limited to the extent permitted by Hungarian law; we are not liable for indirect loss.
        </p>
      </Block>
      <Block title="Resort order and ads">
        <p>
          How resorts are sorted and filtered is described on the{" "}
          <a href={rankingPath}>resort ranking page</a>. Paid promotions and affiliate links never change map order or search ranking.
        </p>
      </Block>
      <Block title="Intellectual property">
        <p>Application code is all rights reserved. Open data licences are listed on the data sources page.</p>
      </Block>
    </>
  );
}

export function TermsHu({ rankingPath }: { rankingPath: string }) {
  return (
    <>
      <Block title="A szolgáltatás használata">
        <p>Ingyenes tájékoztató szolgáltatás síbérletekről és síterepekről.</p>
      </Block>
      <Block title="Pontossági nyilatkozat">
        <p>
          Az adatok hibásak vagy elavultak lehetnek. Utazás vagy vásárlás előtt mindig ellenőrizze a hivatalos weboldalt. A felelősség a magyar jog által megengedett mértékig korlátozott.
        </p>
      </Block>
      <Block title="Rangsorolás és hirdetések">
        <p>
          A síterep-sorrend a{" "}
          <a href={rankingPath}>rangsort leíró oldalon</a> olvasható. A fizetős promóciók és affiliate linkek nem befolyásolják a térképi sorrendet.
        </p>
      </Block>
    </>
  );
}

export function RankingEn() {
  return (
    <>
      <Block title="P2B Art. 5 — main parameters">
        <ul>
          <li>Geographic filters and search text match resort names and regions.</li>
          <li>Default map sort uses distance from your chosen reference place when set; otherwise name.</li>
          <li>List sort options: distance, day ticket price, elevation, slope km, name.</li>
          <li>Pass filters show only resorts covered by selected passes.</li>
          <li>Resorts marked unverified or hidden by data rules are excluded from the map.</li>
        </ul>
      </Block>
      <Block title="Paid influence">
        <p>Affiliate links, donations, ads and resort promos never increase ranking, pin placement or search position.</p>
      </Block>
    </>
  );
}

export function RankingHu() {
  return (
    <>
      <Block title="Fő rangsorolási paraméterek (P2B 5. cikk)">
        <ul>
          <li>Földrajzi szűrők és névkeresés.</li>
          <li>Távolság a választott referenciaponttól, vagy név szerinti rendezés.</li>
          <li>Lista rendezési opciók: távolság, napijegy, magasság, pályakm, név.</li>
          <li>Bérlet-szűrők.</li>
        </ul>
      </Block>
      <Block title="Fizetett befolyás">
        <p>Affiliate linkek, hirdetések és promóciók nem javítják a rangsort.</p>
      </Block>
    </>
  );
}
