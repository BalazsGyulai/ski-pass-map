import type { Metadata } from "next";
import { LocalRedirect } from "@/components/LocalRedirect";
import type { Lang } from "@/i18n/languages";
import { isLang } from "@/i18n/languages";
import { buildPageMetadata } from "@/i18n/metadata";

/** Saved resorts are part of My plan now. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang: raw } = await params;
  if (!isLang(raw)) return {};
  const meta = await buildPageMetadata(raw as Lang, "/plan", "planTitle");
  return { ...meta, robots: { index: false, follow: true } };
}

export default function SavedPage() {
  return <LocalRedirect to="/plan" hash="saved" label="myPlanLink" />;
}
