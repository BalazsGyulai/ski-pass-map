import type { D1Like } from "@/lib/db/types";
import { hashSupportCode } from "./kofi-crypto";

export interface RedeemEnv {
  SUPPORT_CODE_SALT?: string;
  DB?: D1Like;
}

const MAX_QUIET_DAYS = 30;

export async function redeemSupportCode(
  code: string,
  env: RedeemEnv,
  now = Date.now(),
): Promise<{ ok: true; until: number } | { ok: false; error: string }> {
  const salt = env.SUPPORT_CODE_SALT;
  if (!salt || !env.DB) return { ok: false, error: "unavailable" };
  const hash = hashSupportCode(code, salt);
  const row = await env.DB.prepare(
    `SELECT expires_at FROM support_codes WHERE code_hash = ? AND expires_at > ? ORDER BY expires_at DESC LIMIT 1`,
  )
    .bind(hash, now)
    .first<{ expires_at: number }>();
  if (!row) return { ok: false, error: "invalid" };
  const maxUntil = now + MAX_QUIET_DAYS * 86400000;
  const until = Math.min(Number(row.expires_at), maxUntil);
  return { ok: true, until };
}
