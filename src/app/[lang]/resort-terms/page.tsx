import type { Metadata } from "next";
import { isLang } from "@/i18n/languages";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  const lang = raw === "de" ? "de" : "en";
  return {
    title: lang === "de" ? "Portal-Bedingungen (ENTWURF)" : "Resort Terms (DRAFT)",
    robots: { index: false, follow: false },
  };
}

export default async function ResortTermsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw === "de" ? "de" : "en";
  const draft = lang === "de" ? "ENTWURF – NICHT RECHTSBERATUNG" : "DRAFT – NOT LEGAL ADVICE";
  return (
    <main className="legal-page">
      <p className="badge warn">{draft}</p>
      <h1>{lang === "de" ? "Portal-Bedingungen für Skigebiete" : "Resort portal terms"}</h1>
      <p>
        {lang === "de"
          ? "Balázs Gyulai e.v., [Sitz], Reg.-Nr. [ ], Steuernr. [ ]"
          : "Balázs Gyulai e.v., [seat], reg. no. [ ], tax no. [ ]"}
      </p>
      <ol>
        <li>{lang === "de" ? "Geltungsbereich: kostenloses Resort-Portal von Skimap." : "Scope: free Skimap resort portal."}</li>
        <li>{lang === "de" ? "Verifizierung per Einladungslink an die offizielle Domain." : "Verification via invite link on the official domain."}</li>
        <li>{lang === "de" ? "Passkey/TOTP, persönliche Konten, Audit-Log." : "Passkey/TOTP, personal accounts, audit log."}</li>
        <li>{lang === "de" ? "Tier A auto-publish mit Quellenprüfung und Limits; Tier B/C Vorabfreigabe." : "Tier A auto-publish with source checks and limits; Tier B/C pre-approval."}</li>
        <li>{lang === "de" ? "Werbung als „Anzeige“, ohne Ranking-Einfluss." : "Ads labelled “Ad”, no ranking influence."}</li>
        <li>{lang === "de" ? "15 Tage Frist bei Änderungen der Bedingungen; 30 Tage Kündigung." : "15 days notice for term changes; 30 days termination."}</li>
      </ol>
      <p className="hint">
        {lang === "de"
          ? "Vollständiger Mustertext: siehe internes Rechtsmemo §5."
          : "Full sample clauses: see internal legal memo section 5."}
      </p>
    </main>
  );
}
