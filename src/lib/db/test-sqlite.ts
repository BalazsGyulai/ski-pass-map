import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createSqlExecutor, type SqlExecutor } from "./types";

export function createTestSqlExecutor(): SqlExecutor {
  const root = process.cwd();
  const migration1 = fs.readFileSync(path.join(root, "migrations/0001_init.sql"), "utf8");
  const migration2 = fs.readFileSync(path.join(root, "migrations/0002_portal.sql"), "utf8");
  const db = new Database(":memory:");
  db.exec(migration1);
  db.exec(migration2);
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
