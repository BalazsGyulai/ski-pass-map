import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MONTHLY_LIMIT,
  MAP_LOAD_SCHEMA_STATEMENTS,
  RATE_LIMIT_MAX,
  RATE_WINDOW_MS,
  SQL_BUCKET,
  SQL_INCREMENT,
  createD1Store,
  createSqlStore,
  handleMapLoad,
  monthKey,
  parseMonthlyLimit,
  type D1Like,
  type MapLoadStore,
  type SqlExecutor,
} from "./map-load";

function openDb() {
  const db = new DatabaseSync(":memory:");
  const executor: SqlExecutor = {
    exec: (sql) => {
      db.exec(sql);
    },
    run: (sql, args) => {
      db.prepare(sql).run(...args);
    },
    get: (sql, args) => (db.prepare(sql).get(...args) as Record<string, unknown> | undefined) ?? null,
  };
  return { db, store: createSqlStore(executor) };
}

function d1Of(db: DatabaseSync): D1Like {
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async <T extends Record<string, unknown>>() => ((db.prepare(sql).get(...args) as T | undefined) ?? null),
      }),
    }),
  };
}

const env = { MAP_LOAD_HASH_SALT: "test-salt-value" };

function post(ip = "203.0.113.10", extra?: { origin?: string; method?: string; url?: string; body?: string }) {
  const method = extra?.method ?? "POST";
  return new Request(extra?.url ?? "https://skimap.example/api/map-load", {
    method,
    headers: {
      origin: extra?.origin ?? "https://skimap.example",
      "cf-connecting-ip": ip,
      "content-type": "text/plain",
    },
    body: method === "GET" || method === "HEAD" ? undefined : (extra?.body ?? '{"month":"1999-01"}'),
  });
}

async function provider(store: MapLoadStore, now: Date, limit: string, ip?: string) {
  const response = await handleMapLoad(post(ip), { ...env, MAPBOX_MONTHLY_LIMIT: limit }, store, now);
  return { status: response.status, body: (await response.json()) as { provider: string } };
}

describe("map load counter", () => {
  it("keeps the schema file and the function SQL in step", () => {
    const schema = readFileSync(new URL("../../functions/schema.sql", import.meta.url), "utf8").replace(/\s+/g, " ");
    for (const statement of MAP_LOAD_SCHEMA_STATEMENTS) {
      expect(schema).toContain(statement.replace(/\s+/g, " ").trim());
    }
    expect(schema).toContain("map_loads");
    expect(schema).toContain("rate_buckets");
  });

  it("grants Mapbox under the threshold and switches at the threshold", async () => {
    const { db, store } = openDb();
    const now = new Date("2026-09-15T12:00:00Z");
    expect((await provider(store, now, "2")).body.provider).toBe("mapbox");
    expect((await provider(store, now, "2")).body.provider).toBe("mapbox");
    const blocked = await provider(store, now, "2");
    expect(blocked.status).toBe(200);
    expect(blocked.body.provider).toBe("openfreemap");
    const row = db.prepare("SELECT count FROM map_loads WHERE month = ?").get("2026-09") as { count: number };
    expect(row.count).toBe(2);
  });

  it("starts a new UTC month at zero without touching the previous month", async () => {
    const { db, store } = openDb();
    const september = new Date("2026-09-30T23:30:00Z");
    const october = new Date("2026-10-01T00:30:00Z");
    expect(monthKey(september)).toBe("2026-09");
    expect(monthKey(october)).toBe("2026-10");
    await provider(store, september, "1");
    await provider(store, september, "1");
    const next = await provider(store, october, "1");
    expect(next.body.provider).toBe("mapbox");
    const septemberCount = db.prepare("SELECT count FROM map_loads WHERE month = ?").get("2026-09") as { count: number };
    const octoberCount = db.prepare("SELECT count FROM map_loads WHERE month = ?").get("2026-10") as { count: number };
    expect(septemberCount.count).toBe(1);
    expect(octoberCount.count).toBe(1);
  });

  it("rate limits per hashed bucket and does not let the extra calls move the month", async () => {
    const { db, store } = openDb();
    const now = new Date("2026-11-02T08:00:00Z");
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      const result = await provider(store, now, "");
      expect(result.status).toBe(200);
      expect(result.body.provider).toBe("mapbox");
    }
    const limited = await provider(store, now, "");
    expect(limited.status).toBe(429);
    expect(limited.body.provider).toBe("openfreemap");
    const count = db.prepare("SELECT count FROM map_loads WHERE month = ?").get("2026-11") as { count: number };
    expect(count.count).toBe(RATE_LIMIT_MAX);
    const later = await provider(store, new Date(now.getTime() + RATE_WINDOW_MS), "");
    expect(later.status).toBe(200);
    expect(later.body.provider).toBe("mapbox");
    const otherIp = await provider(store, now, "", "203.0.113.11");
    expect(otherIp.body.provider).toBe("mapbox");
    const buckets = db.prepare("SELECT bucket FROM rate_buckets").all() as Array<{ bucket: string }>;
    expect(buckets.length).toBeGreaterThan(0);
    for (const bucket of buckets) {
      expect(bucket.bucket).not.toContain("203.0.113");
      expect(bucket.bucket).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("rejects the wrong method or origin before touching the counter", async () => {
    const { db, store } = openDb();
    const now = new Date("2026-08-01T00:00:00Z");
    const get = await handleMapLoad(post("203.0.113.10", { method: "GET" }), env, store, now);
    expect(get.status).toBe(405);
    expect(get.headers.get("allow")).toBe("POST");
    const missing = await handleMapLoad(new Request("https://skimap.example/api/map-load", { method: "POST" }), env, store, now);
    expect(missing.status).toBe(403);
    const foreign = await handleMapLoad(post("203.0.113.10", { origin: "https://evil.example" }), env, store, now);
    expect(foreign.status).toBe(403);
    const allowed = await handleMapLoad(
      post("203.0.113.10", { origin: "https://preview.example" }),
      { ...env, MAP_LOAD_ALLOWED_ORIGINS: "https://preview.example" },
      store,
      now,
    );
    expect(allowed.status).toBe(200);
    expect(db.prepare("SELECT COUNT(*) AS n FROM map_loads").get()).toEqual({ n: 1 });
    const body = await allowed.json();
    expect(JSON.stringify(body)).not.toContain("203.0.113");
  });

  it("uses the default budget, ignores a bad limit, and hides store failures", async () => {
    expect(parseMonthlyLimit(undefined)).toBe(DEFAULT_MONTHLY_LIMIT);
    expect(parseMonthlyLimit("")).toBe(DEFAULT_MONTHLY_LIMIT);
    expect(parseMonthlyLimit("nope")).toBe(DEFAULT_MONTHLY_LIMIT);
    expect(parseMonthlyLimit("1200")).toBe(1200);
    expect(DEFAULT_MONTHLY_LIMIT).toBe(45_000);
    const failing: MapLoadStore = {
      tryIncrement: () => {
        throw new Error("d1 down");
      },
      bumpBucket: async () => 1,
    };
    const response = await handleMapLoad(post(), env, failing, new Date("2026-01-01T00:00:00Z"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ provider: "openfreemap" });
  });

  it("runs the same SQL through the D1 adapter", async () => {
    const db = new DatabaseSync(":memory:");
    const store = createD1Store(d1Of(db));
    const response = await handleMapLoad(post(), { ...env, MAPBOX_MONTHLY_LIMIT: "1" }, store, new Date("2026-04-01T00:00:00Z"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ provider: "mapbox" });
    const again = await handleMapLoad(post(), { ...env, MAPBOX_MONTHLY_LIMIT: "1" }, store, new Date("2026-04-01T00:00:00Z"));
    expect(await again.json()).toEqual({ provider: "openfreemap" });
    expect(SQL_INCREMENT).toContain("map_loads.count < ?");
    expect(SQL_BUCKET).toContain("RETURNING hits");
  });
});
