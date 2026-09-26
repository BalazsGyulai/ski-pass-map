import type { EditTier } from "@/lib/db/types";
import type { FieldCheckResult } from "./deterministic";

export interface CheckerSummary {
  deterministic: FieldCheckResult[];
  ai: FieldCheckResult[] | null;
  tier: EditTier;
  autoPublishable: boolean;
}

function allSupported(results: FieldCheckResult[]): boolean {
  return results.length > 0 && results.every((r) => r.verdict === "supported");
}

export function mergeCheckerResults(
  tier: EditTier,
  deterministic: FieldCheckResult[],
  ai: FieldCheckResult[] | null,
): CheckerSummary {
  const autoPublishable =
    tier === "A" &&
    allSupported(deterministic) &&
    (ai == null ? true : allSupported(ai));
  return { deterministic, ai, tier, autoPublishable };
}
