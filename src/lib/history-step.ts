export type HistoryStep =
  | { type: "noop" }
  | { type: "replace"; url: string }
  | { type: "seed"; bare: string; resortUrl: string }
  | { type: "push"; bare: string; resortUrl: string }
  | { type: "sync-under"; bare: string; resortUrl: string };

/**
 * Decide how the map URL should move.
 * Opening a resort keeps a non-resort entry underneath so Back can close it.
 * Later filter edits must rewrite that under-entry; replaceState only updates
 * the current resort entry, and Back would otherwise restore the old filters.
 */
export function shareHistoryStep(input: {
  onMap: boolean;
  next: string;
  current: string;
  previousResort: string | null | undefined;
  resort: string | null;
  pushed: boolean;
  historyFlag: boolean;
  bare: string;
  rememberedBare: string | null;
}): HistoryStep {
  if (!input.onMap) {
    return input.next === input.current ? { type: "noop" } : { type: "replace", url: input.next };
  }
  if (input.previousResort === undefined && input.resort && !input.historyFlag) {
    return { type: "seed", bare: input.bare, resortUrl: input.next };
  }
  if (input.next === input.current) return { type: "noop" };
  if (input.resort && !input.pushed) {
    return { type: "push", bare: input.bare, resortUrl: input.next };
  }
  if (input.resort && input.pushed && input.bare !== input.rememberedBare) {
    return { type: "sync-under", bare: input.bare, resortUrl: input.next };
  }
  return { type: "replace", url: input.next };
}
