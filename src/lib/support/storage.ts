/** Support prompt counters — date (UTC YYYY-MM-DD) + count only, no user id. */

export const SUPPORT_FIRST_VISIT_KEY = "skimap-support-first-visit";
export const SUPPORT_DAILY_KEY = "skimap-support-daily";
export const SUPPORT_REWARD_UNTIL_KEY = "skimap-support-reward-until";
export const SUPPORT_CODE_UNTIL_KEY = "skimap-support-code-until";
export const SUPPORT_DEV_FORCE_PARAM = "supportPrompt";

export interface SupportDaily {
  day: string;
  count: number;
}

function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function readSupportDaily(storage: Storage, now = Date.now()): SupportDaily {
  try {
    const raw = storage.getItem(SUPPORT_DAILY_KEY);
    if (!raw) return { day: utcDay(now), count: 0 };
    const parsed = JSON.parse(raw) as SupportDaily;
    if (!parsed?.day) return { day: utcDay(now), count: 0 };
    if (parsed.day !== utcDay(now)) return { day: utcDay(now), count: 0 };
    return { day: parsed.day, count: Number(parsed.count) || 0 };
  } catch {
    return { day: utcDay(now), count: 0 };
  }
}

export function writeSupportDaily(storage: Storage, daily: SupportDaily): void {
  storage.setItem(SUPPORT_DAILY_KEY, JSON.stringify(daily));
}

export function markFirstVisitDone(storage: Storage): void {
  storage.setItem(SUPPORT_FIRST_VISIT_KEY, "1");
}

export function hasCompletedFirstVisit(storage: Storage): boolean {
  return storage.getItem(SUPPORT_FIRST_VISIT_KEY) === "1";
}

export function readQuietUntil(storage: Storage): number {
  const keys = [SUPPORT_REWARD_UNTIL_KEY, SUPPORT_CODE_UNTIL_KEY];
  let max = 0;
  for (const key of keys) {
    const v = Number(storage.getItem(key));
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

export function isInQuietPeriod(storage: Storage, now = Date.now()): boolean {
  return readQuietUntil(storage) > now;
}

export function setRewardQuietDays(storage: Storage, days: number, now = Date.now()): void {
  const until = now + days * 24 * 60 * 60 * 1000;
  storage.setItem(SUPPORT_REWARD_UNTIL_KEY, String(until));
}

export function setCodeQuietUntil(storage: Storage, untilMs: number): void {
  storage.setItem(SUPPORT_CODE_UNTIL_KEY, String(untilMs));
}

export function resetSupportReminders(storage: Storage): void {
  storage.removeItem(SUPPORT_DAILY_KEY);
  storage.removeItem(SUPPORT_REWARD_UNTIL_KEY);
  storage.removeItem(SUPPORT_CODE_UNTIL_KEY);
}

export interface SupportPromptInput {
  storage: Storage;
  now: number;
  dev: boolean;
  search: string;
  forceDevParam?: boolean;
  allowForceParam?: boolean;
}

export function shouldShowSupportPrompt(input: SupportPromptInput): boolean {
  const params = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  if (input.forceDevParam && params.get(SUPPORT_DEV_FORCE_PARAM) === "1") {
    if (input.dev || input.allowForceParam) return true;
  }
  if (!hasCompletedFirstVisit(input.storage)) return false;
  if (isInQuietPeriod(input.storage, input.now)) return false;
  const daily = readSupportDaily(input.storage);
  return daily.count < 4;
}

export function recordSupportPromptShown(storage: Storage, now = Date.now()): void {
  const daily = readSupportDaily(storage, now);
  writeSupportDaily(storage, { day: daily.day, count: daily.count + 1 });
}
