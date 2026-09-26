import type { D1Like } from "@/lib/db/types";

export interface StatEnv {
  STATS_ENABLED?: string;
  DB?: D1Like;
}

const RATE_BUCKET = "stat:global";
const RATE_MAX = 120;
const RATE_WINDOW_MS = 60_000;

export async function handleStatPost(
  request: Request,
  env: StatEnv,
  sql: D1Like,
  now = Date.now(),
): Promise<Response> {
  if (env.STATS_ENABLED !== "1" && env.STATS_ENABLED !== "true") {
    return json({ ok: false, error: "disabled" }, 404);
  }
  if (request.method !== "POST") return json({ ok: false }, 405);
  let body: { path?: string };
  try {
    body = (await request.json()) as { path?: string };
  } catch {
    return json({ ok: false }, 400);
  }
  const path = normalizePath(body.path);
  if (!path) return json({ ok: false }, 400);

  const bucketHits = await bumpRate(sql, RATE_BUCKET, now, RATE_WINDOW_MS);
  if (bucketHits > RATE_MAX) return json({ ok: false, error: "rate_limited" }, 429);

  const day = new Date(now).toISOString().slice(0, 10);
  await sql
    .prepare(
      `INSERT INTO page_stats (day_utc, path, hits) VALUES (?, ?, 1)
       ON CONFLICT(day_utc, path) DO UPDATE SET hits = page_stats.hits + 1`,
    )
    .bind(day, path)
    .run();

  return json({ ok: true });
}

export async function listPageStats(sql: D1Like, days = 14): Promise<{ day_utc: string; path: string; hits: number }[]> {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const result = await sql
    .prepare(`SELECT day_utc, path, hits FROM page_stats WHERE day_utc >= ? ORDER BY day_utc DESC, hits DESC LIMIT 500`)
    .bind(cutoff)
    .all();
  return (result.results ?? []) as { day_utc: string; path: string; hits: number }[];
}

function normalizePath(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.split("?")[0].split("#")[0].trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.length > 200) return null;
  return trimmed;
}

async function bumpRate(sql: D1Like, bucket: string, now: number, windowMs: number): Promise<number> {
  const expires = now + windowMs;
  const row = await sql
    .prepare(
      `INSERT INTO rate_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
       ON CONFLICT(bucket) DO UPDATE SET
         hits = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.hits + 1 END,
         expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END
       RETURNING hits`,
    )
    .bind(bucket, expires, now, now, expires)
    .first();
  return Number((row as { hits?: number })?.hits ?? 1);
}

function json(data: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
