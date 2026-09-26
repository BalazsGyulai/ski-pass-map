import type { FieldChange } from "@/lib/admin/edits";
import { classifyTier } from "@/lib/admin/edits";
import { safeFetchText, setSourceCheckerDevHosts } from "@/lib/ssrf";
import type { AiBinding } from "./ai";
import { runAiChecks } from "./ai";
import { runDeterministicChecks } from "./deterministic";
import { mergeCheckerResults, type CheckerSummary } from "./tier";

export interface SourceCheckerEnv {
  SOURCE_CHECKER_DEV_HOSTS?: string;
  NODE_ENV?: string;
}

export async function checkSourceForEdit(
  sourceUrl: string,
  changes: FieldChange[],
  ai?: AiBinding,
  env?: SourceCheckerEnv,
): Promise<CheckerSummary & { sourceUrl: string; fetchedChars: number }> {
  if (env?.NODE_ENV !== "production" && env?.SOURCE_CHECKER_DEV_HOSTS) {
    setSourceCheckerDevHosts(env.SOURCE_CHECKER_DEV_HOSTS.split(","));
  }
  const { text, finalUrl } = await safeFetchText(sourceUrl, { maxBytes: 2_000_000, timeoutMs: 10_000, maxRedirects: 3 });
  const deterministic = runDeterministicChecks(changes, text);
  const aiResults = await runAiChecks(ai, changes, text);
  const tier = classifyTier(changes);
  const summary = mergeCheckerResults(tier, deterministic, aiResults);
  return { ...summary, sourceUrl: finalUrl, fetchedChars: text.length };
}

export type { FieldCheckResult } from "./deterministic";
export type { CheckerSummary } from "./tier";
