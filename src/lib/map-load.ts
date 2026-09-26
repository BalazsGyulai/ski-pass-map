/**
 * Monthly Mapbox map-load counter for the Cloudflare Pages function.
 * The client calls POST /api/map-load once per Mapbox map construction.
 * Static hosts without this function never reach it, and the client uses OpenFreeMap.
 *
 * The raw IP is hashed into a short-lived bucket. It is not stored and not returned.
 */

export const DEFAULT_MONTHLY_LIMIT = 45_000;
export const RATE_LIMIT_MAX = 8;
export const RATE_WINDOW_MS = 10 * 60 * 1000;

export const MAP_LOAD_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS map_loads (
  month TEXT PRIMARY KEY,
  count INTEGER NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
)`,
];

export const SQL_INCREMENT = `INSERT INTO map_loads (month, count) VALUES (?, 1)
ON CONFLICT(month) DO UPDATE SET count = map_loads.count + 1
WHERE map_loads.count < ?
RETURNING count`;

export const SQL_GET = `SELECT count FROM map_loads WHERE month = ?`;

export const SQL_DELETE_EXPIRED = `DELETE FROM rate_buckets WHERE expires_at <= ?`;

export const SQL_BUCKET = `INSERT INTO rate_buckets (bucket, hits, expires_at) VALUES (?, 1, ?)
ON CONFLICT(bucket) DO UPDATE SET
  hits = CASE WHEN rate_buckets.expires_at <= ? THEN 1 ELSE rate_buckets.hits + 1 END,
  expires_at = CASE WHEN rate_buckets.expires_at <= ? THEN ? ELSE rate_buckets.expires_at END
RETURNING hits`;

export interface SqlExecutor {
  exec(sql: string): Promise<void> | void;
  run(sql: string, args: Array<string | number>): Promise<void> | void;
  get(sql: string, args: Array<string | number>): Promise<Record<string, unknown> | null | undefined> | Record<string, unknown> | null | undefined;
}

export interface MapLoadStore {
  tryIncrement(month: string, limit: number): Promise<{ count: number; granted: boolean }>;
  bumpBucket(bucket: string, nowMs: number, windowMs: number): Promise<number>;
}

export interface MapLoadEnv {
  MAPBOX_MONTHLY_LIMIT?: string;
  MAP_LOAD_ALLOWED_ORIGINS?: string;
  MAP_LOAD_HASH_SALT?: string;
}

export interface D1Like {
  exec(sql: string): Promise<unknown>;
  prepare(sql: string): {
    bind(...values: Array<string | number>): {
      first<T extends Record<string, unknown>>(): Promise<T | null>;
    };
  };
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthlyLimit(value: string | undefined): number {
  if (value == null || value.trim() === "") return DEFAULT_MONTHLY_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return DEFAULT_MONTHLY_LIMIT;
  return parsed;
}

export function parseOrigins(value: string | undefined): string[] {
  if (!value) return [];
  const origins: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      origins.push(new URL(trimmed).origin);
    } catch {
      origins.push(trimmed);
    }
  }
  return origins;
}

export function originAllowed(request: Request, extraOrigins: string[]): boolean {
  const header = request.headers.get("origin");
  if (!header) return false;
  let origin: string;
  try {
    origin = new URL(header).origin;
  } catch {
    return false;
  }
  let self = "";
  try {
    self = new URL(request.url).origin;
  } catch {
    self = "";
  }
  return origin === self || extraOrigins.includes(origin);
}

export async function hashBucket(salt: string, windowStart: number, ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${windowStart}|${ip}`));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

let isolateSalt: string | null = null;

function saltFor(env: MapLoadEnv): string {
  const configured = env.MAP_LOAD_HASH_SALT?.trim();
  if (configured && configured.length >= 8) return configured;
  isolateSalt ??= crypto.randomUUID();
  return isolateSalt;
}

export function createSqlStore(executor: SqlExecutor): MapLoadStore {
  let ready: Promise<void> | null = null;
  const ensure = () => {
    if (!ready) {
      ready = (async () => {
        for (const statement of MAP_LOAD_SCHEMA_STATEMENTS) await executor.exec(statement);
      })().catch((error: unknown) => {
        ready = null;
        throw error;
      });
    }
    return ready;
  };
  return {
    async tryIncrement(month, limit) {
      await ensure();
      const row = await executor.get(SQL_INCREMENT, [month, limit]);
      if (row && typeof row.count === "number" && Number.isFinite(row.count)) return { count: row.count, granted: true };
      const current = await executor.get(SQL_GET, [month]);
      return { count: current && typeof current.count === "number" && Number.isFinite(current.count) ? current.count : 0, granted: false };
    },
    async bumpBucket(bucket, nowMs, windowMs) {
      await ensure();
      await executor.run(SQL_DELETE_EXPIRED, [nowMs]);
      const expires = nowMs + windowMs;
      const row = await executor.get(SQL_BUCKET, [bucket, expires, nowMs, nowMs, expires]);
      return row && typeof row.hits === "number" && Number.isFinite(row.hits) ? row.hits : 1;
    },
  };
}

export function createD1Store(db: D1Like): MapLoadStore {
  return createSqlStore({
    exec: (sql) => db.exec(sql).then(() => undefined),
    run: async (sql, args) => {
      await db.prepare(sql).bind(...args).first();
    },
    get: async (sql, args) => (await db.prepare(sql).bind(...args).first<Record<string, unknown>>()) ?? undefined,
  });
}

function json(provider: "mapbox" | "openfreemap", status: number, extra?: { allow?: string }): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  if (extra?.allow) headers.set("allow", extra.allow);
  return new Response(JSON.stringify({ provider }), { status, headers });
}

export async function handleMapLoad(
  request: Request,
  env: MapLoadEnv,
  store: MapLoadStore,
  now = new Date(),
): Promise<Response> {
  try {
    if (request.method !== "POST") return json("openfreemap", 405, { allow: "POST" });
    if (!originAllowed(request, parseOrigins(env.MAP_LOAD_ALLOWED_ORIGINS))) return json("openfreemap", 403);
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const windowStart = Math.floor(now.getTime() / RATE_WINDOW_MS) * RATE_WINDOW_MS;
    const bucket = await hashBucket(saltFor(env), windowStart, ip);
    const hits = await store.bumpBucket(bucket, now.getTime(), RATE_WINDOW_MS);
    if (hits > RATE_LIMIT_MAX) return json("openfreemap", 429);
    const limit = parseMonthlyLimit(env.MAPBOX_MONTHLY_LIMIT);
    if (limit <= 0) return json("openfreemap", 200);
    const result = await store.tryIncrement(monthKey(now), limit);
    return json(result.granted ? "mapbox" : "openfreemap", 200);
  } catch {
    return json("openfreemap", 503);
  }
}
