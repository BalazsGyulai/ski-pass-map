import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createSqlExecutor, type SqlExecutor } from "./types";

export function createTestSqlExecutor(): SqlExecutor {
  const migration = fs.readFileSync(path.join(process.cwd(), "migrations/0001_init.sql"), "utf8");
  const db = new Database(":memory:");
  db.exec(migration);
  const d1: import("./types").D1Like = {
    exec: async (sql) => {
      db.exec(sql);
    },
    prepare: (sql: string) => ({
      bind: (...values: Array<string | number | null>) => ({
        first: async <T extends Record<string, unknown>>() =>
          (db.prepare(sql).get(...values) as T | undefined) ?? null,
        all: async <T extends Record<string, unknown>>() => ({ results: db.prepare(sql).all(...values) as T[] }),
        run: async () => {
          db.prepare(sql).run(...values);
        },
      }),
    }),
  };
  return createSqlExecutor(d1);
}
