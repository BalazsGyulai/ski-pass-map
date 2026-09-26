import type { AppStore } from "@/lib/db/app-store";
import { hashIp, saltFromEnv } from "@/lib/ip-hash";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;

export async function checkPortalLoginRate(
  store: AppStore,
  request: Request,
  env: { MAP_LOAD_HASH_SALT?: string },
): Promise<{ ok: true } | { ok: false; status: number }> {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const salt = saltFromEnv(env.MAP_LOAD_HASH_SALT, "portal-login-dev-salt");
  const bucket = `portal-login:${await hashIp(salt, "portal", ip)}`;
  const hits = await store.bumpRate(bucket, Date.now(), WINDOW_MS);
  if (hits > MAX_ATTEMPTS) return { ok: false, status: 429 };
  return { ok: true };
}
