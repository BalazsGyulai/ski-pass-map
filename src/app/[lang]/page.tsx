import { ExplorerFrame } from "@/components/ExplorerFrame";
import type { Lang } from "@/i18n/languages";
import { isLang } from "@/i18n/languages";
import { buildPageMetadata } from "@/i18n/metadata";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  return buildPageMetadata(raw as Lang, "/", "title");
}

export default function HomePage() {
  return <ExplorerFrame />;
}
