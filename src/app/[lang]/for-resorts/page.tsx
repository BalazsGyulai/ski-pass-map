import type { Metadata } from "next";
import Link from "next/link";
import { isLang } from "@/i18n/languages";
import { notFound } from "next/navigation";

const COPY: Record<"en" | "de", { title: string; body: string[] }> = {
  en: {
    title: "For ski areas",
    body: [
      "Skimap.eu lists ski areas and season passes using public sources and OpenStreetMap data.",
      "If your listing is wrong, use the contact form and choose “Data error” or “Resort owner”. You can request corrections, a link-only listing (name and official website only), or removal from the map.",
      "Promotions submitted through the resort portal (when enabled) are always labelled “Ad · From [Resort]” and never affect ranking, filtering, or search order.",
      "The self-service portal is optional and may be disabled until legal checks are complete.",
    ],
  },
  de: {
    title: "Für Skigebiete",
    body: [
      "Skimap.eu listet Skigebiete und Saisonkarten anhand öffentlicher Quellen und OpenStreetMap-Daten.",
      "Wenn Ihr Eintrag nicht stimmt, nutzen Sie das Kontaktformular mit „Datenfehler“ oder „Skigebietsbetreiber“. Sie können Korrekturen, einen Nur-Link-Eintrag (nur Name und offizielle Website) oder die Entfernung von der Karte verlangen.",
      "Werbung über das Resort-Portal (wenn aktiviert) ist stets als „Anzeige · vom Skigebiet“ gekennzeichnet und beeinflusst niemals Reihenfolge, Filter oder Suche.",
      "Das Self-Service-Portal ist optional und kann bis zum Abschluss der rechtlichen Checkliste deaktiviert bleiben.",
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  const lang = raw === "de" ? "de" : "en";
  return { title: COPY[lang].title, robots: { index: true, follow: true } };
}

export default async function ForResortsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw === "de" ? "de" : "en";
  const copy = COPY[lang];
  const contact = `/${lang}/support/`;
  return (
    <main className="legal-page">
      <h1>{copy.title}</h1>
      {copy.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
      <p>
        <Link href={contact}>{lang === "de" ? "Kontaktformular" : "Contact form"}</Link>
      </p>
    </main>
  );
}
