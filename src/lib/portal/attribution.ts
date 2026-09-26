export interface ResortAttribution {
  resortName: string;
  updatedAt: string;
  sourceUrl: string;
}

export function formatAttributionLine(attr: ResortAttribution, lang: "en" | "de"): string {
  const date = attr.updatedAt.slice(0, 10);
  if (lang === "de") {
    return `Aktualisiert von ${attr.resortName}, ${date} · Quelle: ${attr.sourceUrl}`;
  }
  return `Updated by ${attr.resortName}, ${date} · Source: ${attr.sourceUrl}`;
}

export function buildAttributionJson(resortName: string, sourceUrl: string, nowMs = Date.now()): string {
  return JSON.stringify({
    resortName,
    updatedAt: new Date(nowMs).toISOString(),
    sourceUrl,
  });
}
