import type { AppStore } from "@/lib/db/app-store";
import { clientIpFromRequest } from "@/lib/client-ip";
import { hashIp, saltFromEnv } from "@/lib/ip-hash";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

export async function checkRedeemRate(
  store: AppStore,
  request: Request,
  env: { MAP_LOAD_HASH_SALT?: string },
  now = Date.now(),
): Promise<{ ok: true } | { ok: false; status: number }> {
  const ip = clientIpFromRequest(request);
  const salt = saltFromEnv(env.MAP_LOAD_HASH_SALT, "redeem-dev-salt");
  const bucket = `redeem:${await hashIp(salt, "redeem", ip)}`;
  const hits = await store.bumpRate(bucket, now, WINDOW_MS);
  if (hits > MAX_ATTEMPTS) return { ok: false, status: 429 };
  return { ok: true };
}
