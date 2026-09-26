import type { EditTier } from "@/lib/db/types";
import type { FieldChange } from "@/lib/admin/edits";

const TIER_C = /(promo|banner|logo|marketing|image|photo)/i;

const TIER_A_PATHS = new Set([
  "seasondates",
  "season",
  "operatinghours",
  "hours",
  "lifts",
  "slopes",
  "slopekm",
  "open",
  "closed",
  "status",
  "passes",
  "website",
  "officialurl",
  "snowreport",
  "snowreporturl",
]);

const TIER_B_KINDS = new Set(["price", "text", "pass"]);

function pathKey(path: string): string {
  const leaf = path.split(".").pop() ?? path;
  return leaf.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function classifyPortalTier(changes: FieldChange[]): EditTier {
  if (changes.some((c) => TIER_C.test(c.path))) return "C";
  const allA = changes.every((c) => {
    if (TIER_B_KINDS.has(c.kind)) return false;
    const key = pathKey(c.path);
    return TIER_A_PATHS.has(key) || c.kind === "number" || c.kind === "date" || c.kind === "url" || c.kind === "lift";
  });
  if (allA) return "A";
  return "B";
}

export function fieldTierLabel(path: string): EditTier {
  if (TIER_C.test(path)) return "C";
  const key = pathKey(path);
  if (TIER_A_PATHS.has(key)) return "A";
  return "B";
}
