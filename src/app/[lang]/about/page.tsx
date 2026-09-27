import type { Metadata } from "next";
import { AboutView } from "@/components/AboutView";
import type { Lang } from "@/i18n/languages";
import { isLang } from "@/i18n/languages";
import { buildPageMetadata } from "@/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  return buildPageMetadata(raw as Lang, "/about", "aboutTitle");
}

export default function AboutPage() {
  return <AboutView />;
}
