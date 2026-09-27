import type { Metadata } from "next";
import { CompareView } from "@/components/CompareView";
import type { Lang } from "@/i18n/languages";
import { isLang } from "@/i18n/languages";
import { buildPageMetadata } from "@/i18n/metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  return buildPageMetadata(raw as Lang, "/compare", "compareTitle");
}

export default function ComparePage() {
  return <CompareView />;
}
