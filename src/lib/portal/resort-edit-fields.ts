import resortsFile from "../../../data/resorts.json";
import osmFile from "../../../data/osm.json";
import type { FieldChange } from "@/lib/admin/edits";
import { fieldTierLabel } from "./tier-fields";
import type { EditTier } from "@/lib/db/types";

export interface PortalFieldDef {
  id: string;
  path: string;
  kind: FieldChange["kind"];
  labelDe: string;
  labelEn: string;
  tier: EditTier;
}

export const PORTAL_FIELD_DEFS: PortalFieldDef[] = [
  { id: "seasonDates", path: "seasonDates.value", kind: "date", labelDe: "Saison", labelEn: "Season dates", tier: fieldTierLabel("seasonDates") },
  { id: "website", path: "website.value", kind: "url", labelDe: "Offizielle Website", labelEn: "Official website", tier: fieldTierLabel("website") },
  { id: "snowReport", path: "snowReport.value", kind: "url", labelDe: "Schneebericht-URL", labelEn: "Snow report URL", tier: fieldTierLabel("snowReport") },
  { id: "lifts", path: "lifts", kind: "lift", labelDe: "Anzahl Lifte", labelEn: "Lift count", tier: fieldTierLabel("lifts") },
  { id: "slopeKm", path: "slopeKm", kind: "number", labelDe: "Pistenkilometer", labelEn: "Slope km", tier: fieldTierLabel("slopeKm") },
  { id: "publicTransport", path: "publicTransport", kind: "text", labelDe: "ÖPNV-Hinweis", labelEn: "Public transport note", tier: fieldTierLabel("publicTransport") },
];

export function tierHint(tier: EditTier, lang: "de" | "en"): string {
  if (tier === "A") return lang === "de" ? "Veröffentlichung nach automatischer Prüfung" : "Publishes after automatic check";
  if (tier === "C") return lang === "de" ? "Anzeige, Freigabe nötig" : "Ad, needs review";
  return lang === "de" ? "Freigabe durch Skimap nötig" : "Needs review";
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur ?? null;
}

export function resortRecordById(resortId: string) {
  return resortsFile.resorts.find((r) => r.id === resortId);
}

export function resortPortalSnapshot(resortId: string): { id: string; name: string; fields: Record<string, string | number | null> } | null {
  const record = resortRecordById(resortId);
  if (!record) return null;
  const osm = osmFile.resorts.find((r) => r.id === resortId);
  const raw = record as Record<string, unknown>;
  const fields: Record<string, string | number | null> = {};
  for (const def of PORTAL_FIELD_DEFS) {
    if (def.path === "lifts") fields[def.id] = osm?.lifts ?? null;
    else if (def.path === "slopeKm") fields[def.id] = osm?.slopeKm ?? null;
    else if (def.path === "publicTransport") fields[def.id] = record.publicTransport ?? null;
    else {
      const v = getNested(raw, def.path);
      fields[def.id] = v == null ? null : typeof v === "number" ? v : String(v);
    }
  }
  return { id: resortId, name: record.name, fields };
}

export function buildChangesFromForm(
  resortId: string,
  values: Record<string, string>,
  sourceUrl: string,
): { changes: FieldChange[]; before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const snap = resortPortalSnapshot(resortId);
  if (!snap) return null;
  const changes: FieldChange[] = [];
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const def of PORTAL_FIELD_DEFS) {
    const prev = snap.fields[def.id];
    const raw = values[def.id]?.trim() ?? "";
    if (raw === "" && (prev == null || prev === "")) continue;
    let next: unknown = raw;
    if (def.kind === "lift" || def.kind === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      next = n;
    }
    const prevStr = prev == null ? "" : String(prev);
    const nextStr = String(next);
    if (prevStr === nextStr) continue;
    changes.push({ path: def.path, before: prev, after: next, kind: def.kind });
    setDeep(before, def.path, prev);
    setDeep(after, def.path, next);
  }
  if (changes.length === 0) return null;
  void sourceUrl;
  return { changes, before, after };
}

function setDeep(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof cur[key] !== "object" || cur[key] == null) cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}
