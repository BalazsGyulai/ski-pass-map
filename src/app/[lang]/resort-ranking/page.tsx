import type { Metadata } from "next";
import type { Lang } from "@/i18n/languages";
import { isLang } from "@/i18n/languages";
import { buildPageMetadata } from "@/i18n/metadata";
import { RankingContent } from "./RankingContent";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  return buildPageMetadata(raw as Lang, "/resort-ranking", "rankingTitle");
}

export default function ResortRankingPage() {
  return <RankingContent />;
}
