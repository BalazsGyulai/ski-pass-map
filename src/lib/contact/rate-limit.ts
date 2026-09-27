import type { AppStore } from "@/lib/db/app-store";
import { hashIp, saltFromEnv } from "@/lib/ip-hash";

export const CONTACT_HOURLY_MAX = 5;
export const CONTACT_HOURLY_MS = 60 * 60 * 1000;
export const CONTACT_GLOBAL_DAILY_MAX = 200;

export interface ContactRateEnv {
  MAP_LOAD_HASH_SALT?: string;
  CONTACT_GLOBAL_DAILY_MAX?: string;
  CONTACT_HOURLY_MAX?: string;
}

function parseLimit(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function checkContactRateLimits(
  store: AppStore,
  env: ContactRateEnv,
  ip: string,
  nowMs: number,
  devSalt = "local-dev-salt",
): Promise<{ allowed: true } | { allowed: false; reason: "hourly" | "global" }> {
  const salt = saltFromEnv(env.MAP_LOAD_HASH_SALT, devSalt);
  const hourlyMax = parseLimit(env.CONTACT_HOURLY_MAX, CONTACT_HOURLY_MAX);
  const globalMax = parseLimit(env.CONTACT_GLOBAL_DAILY_MAX, CONTACT_GLOBAL_DAILY_MAX);
  const hourStart = Math.floor(nowMs / CONTACT_HOURLY_MS) * CONTACT_HOURLY_MS;
  const dayKey = new Date(nowMs).toISOString().slice(0, 10);
  const ipBucket = await hashIp(salt, `contact-hour-${hourStart}`, ip);
  const ipHits = await store.bumpRate(`contact:ip:${ipBucket}`, nowMs, CONTACT_HOURLY_MS);
  if (ipHits > hourlyMax) return { allowed: false, reason: "hourly" };
  const globalHits = await store.bumpRate(`contact:global:${dayKey}`, nowMs, 24 * 60 * 60 * 1000);
  if (globalHits > globalMax) return { allowed: false, reason: "global" };
  return { allowed: true };
}
