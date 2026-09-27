import type { FieldChange } from "@/lib/admin/edits";
import { classifyTier } from "@/lib/admin/edits";
import { applySourceCheckerDevEnv, safeFetchText, type SourceTextFetcher } from "@/lib/ssrf";
import type { AiBinding } from "./ai";
import { runAiChecks } from "./ai";
import { runDeterministicChecks } from "./deterministic";
import { mergeCheckerResults, type CheckerSummary } from "./tier";

export interface SourceCheckerEnv {
  SOURCE_CHECKER_DEV_HOSTS?: string;
  SOURCE_CHECKER_DEV_FIXTURE?: string;
  NODE_ENV?: string;
}

export interface SourceCheckerDeps {
  fetchText?: SourceTextFetcher;
}

export async function checkSourceForEdit(
  sourceUrl: string,
  changes: FieldChange[],
  ai?: AiBinding,
  env?: SourceCheckerEnv,
  deps?: SourceCheckerDeps,
  request?: Request,
): Promise<CheckerSummary & { sourceUrl: string; fetchedChars: number }> {
  applySourceCheckerDevEnv(env, request);
  const fetchText = deps?.fetchText ?? safeFetchText;
  const { text, finalUrl } = await fetchText(sourceUrl, { maxBytes: 2_000_000, timeoutMs: 10_000, maxRedirects: 3 });
  const deterministic = runDeterministicChecks(changes, text);
  const aiResults = await runAiChecks(ai, changes, text);
  const tier = classifyTier(changes);
  const summary = mergeCheckerResults(tier, deterministic, aiResults);
  return { ...summary, sourceUrl: finalUrl, fetchedChars: text.length };
}

export type { FieldCheckResult } from "./deterministic";
export type { CheckerSummary } from "./tier";
