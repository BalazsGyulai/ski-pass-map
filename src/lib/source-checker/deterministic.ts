import type { FieldChange } from "@/lib/admin/edits";

export type FieldVerdict = "supported" | "contradicted" | "not-found";

export interface FieldCheckResult {
  path: string;
  verdict: FieldVerdict;
  snippet: string | null;
}

function normalizeNumber(value: unknown): string | null {
  if (value == null) return null;
  const raw = String(value).replace(/\s/g, "").replace(",", ".");
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}

function normalizeDate(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value);
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}

function findSnippet(text: string, needle: string): string | null {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return null;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + needle.length + 60);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function deterministicFieldCheck(change: FieldChange, pageText: string): FieldCheckResult {
  const flat = pageText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const afterStr = String(change.after ?? "");
  if (!afterStr) return { path: change.path, verdict: "not-found", snippet: null };

  if (change.kind === "price" || change.kind === "number") {
    const num = normalizeNumber(change.after);
    if (!num) return { path: change.path, verdict: "not-found", snippet: null };
    const regex = new RegExp(num.replace(".", "[.,]"));
    if (regex.test(flat)) return { path: change.path, verdict: "supported", snippet: findSnippet(flat, num) };
    return { path: change.path, verdict: "not-found", snippet: null };
  }
  if (change.kind === "date") {
    const iso = normalizeDate(change.after);
    if (!iso) return { path: change.path, verdict: "not-found", snippet: null };
    const variants = [iso, iso.split("-").reverse().join(".")];
    for (const v of variants) {
      if (flat.includes(v)) return { path: change.path, verdict: "supported", snippet: findSnippet(flat, v) };
    }
    return { path: change.path, verdict: "not-found", snippet: null };
  }
  if (change.kind === "url") {
    const url = afterStr.replace(/\/$/, "");
    if (flat.includes(url) || flat.includes(`${url}/`)) {
      return { path: change.path, verdict: "supported", snippet: findSnippet(flat, url) };
    }
    return { path: change.path, verdict: "not-found", snippet: null };
  }
  if (flat.toLowerCase().includes(afterStr.toLowerCase().slice(0, 80))) {
    return { path: change.path, verdict: "supported", snippet: findSnippet(flat, afterStr.slice(0, 40)) };
  }
  return { path: change.path, verdict: "not-found", snippet: null };
}

export function runDeterministicChecks(changes: FieldChange[], pageText: string): FieldCheckResult[] {
  return changes.map((c) => deterministicFieldCheck(c, pageText));
}
