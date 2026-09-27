import type { Metadata } from "next";
import type { Lang } from "@/i18n/languages";
import { LANGS } from "@/i18n/languages";
import { loadMessages } from "@/i18n/load-messages";
import { pathWithLang } from "@/i18n/routing";
import type { MessageKey } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { BASE_PATH, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

function absolute(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${BASE_PATH}${normalized}`.replace(/([^:]\/)\/+/g, "$1");
}

export function buildAlternates(rest: string, lang: Lang = "en"): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const code of LANGS) {
    languages[code] = absolute(pathWithLang(code, rest));
  }
  languages["x-default"] = absolute(pathWithLang("en", rest));
  return { languages, canonical: absolute(pathWithLang(lang, rest)) };
}

export async function buildPageMetadata(lang: Lang, rest: string, titleKey: MessageKey): Promise<Metadata> {
  const messages = await loadMessages(lang);
  const title = translate(messages, titleKey);
  const description = messages.metaDescription;
  return {
    title,
    description,
    alternates: buildAlternates(rest, lang),
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      locale: lang,
    },
  };
}

export async function buildRootLayoutMetadata(lang: Lang): Promise<Metadata> {
  const messages = await loadMessages(lang);
  return {
    title: {
      default: `${messages.title} · ${SITE_NAME}`,
      template: `%s · ${SITE_NAME}`,
    },
    description: messages.metaDescription,
    alternates: buildAlternates("/", lang),
  };
}
