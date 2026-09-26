import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Lang } from "@/i18n/languages";
import { LANGS, isLang } from "@/i18n/languages";
import { loadMessages } from "@/i18n/load-messages";
import { buildRootLayoutMetadata } from "@/i18n/metadata";
import { AppProvider } from "@/components/AppState";
import { Chrome } from "@/components/Chrome";
import { ServiceWorker } from "@/components/ServiceWorker";

export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  return buildRootLayoutMetadata(raw);
}

export default async function LangLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const messages = await loadMessages(lang);
  return (
    <AppProvider lang={lang} messages={messages}>
      <Chrome>{children}</Chrome>
      <ServiceWorker />
    </AppProvider>
  );
}
