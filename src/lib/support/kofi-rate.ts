import type { AppStore } from "@/lib/db/app-store";
import { clientIpFromRequest } from "@/lib/client-ip";
import { hashIp, saltFromEnv } from "@/lib/ip-hash";

const WINDOW_MS = 60_000;
const MAX_PER_IP = 30;
const MAX_GLOBAL = 200;

export async function checkKofiWebhookRate(
  store: AppStore,
  request: Request,
  env: { MAP_LOAD_HASH_SALT?: string },
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; status: number }> {
  const ip = clientIpFromRequest(request);
  const salt = saltFromEnv(env.MAP_LOAD_HASH_SALT, "kofi-dev-salt");
  const ipBucket = `kofi:ip:${await hashIp(salt, "kofi", ip)}`;
  const ipHits = await store.bumpRate(ipBucket, now, WINDOW_MS);
  if (ipHits > MAX_PER_IP) return { ok: false, status: 429 };
  const globalHits = await store.bumpRate("kofi:global", now, WINDOW_MS);
  if (globalHits > MAX_GLOBAL) return { ok: false, status: 429 };
  return { ok: true };
}
