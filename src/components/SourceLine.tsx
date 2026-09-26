import { formatDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import type { FactRef } from "@/lib/schema";
import type { Lang } from "@/lib/url-state";

export function SourceLine({
  source,
  t,
  lang,
  tourism,
}: {
  source: FactRef | undefined;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  lang: Lang;
  tourism?: boolean;
}) {
  if (!source) return null;
  const tourismNote = tourism ? ` · ${t("viaTourismSite")}` : "";
  if (!source.sourceUrl) return <span className="fact-source">{`${t("osmSource")}${tourismNote}`}</span>;
  const text = source.checkedAt ? t("sourceChecked", { date: formatDate(lang, source.checkedAt) }) : t("sourceNote");
  return (
    <a className="fact-source" href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
      {`${text}${tourismNote}`}
    </a>
  );
}
