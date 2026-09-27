export type ContactCategory = "general" | "data-error" | "resort-owner" | "privacy" | "other";
export type ContactStatus = "new" | "flagged" | "done" | "spam";
export type EditStatus = "pending" | "approved" | "rejected" | "auto-published";
export type EditTier = "A" | "B" | "C";
export type EntityType = "resort" | "pass";

export interface ContactMessageRow {
  id: string;
  created_at: number;
  lang: string;
  category: ContactCategory;
  resort_id: string | null;
  email: string | null;
  message: string;
  status: ContactStatus;
  flag_reason: string | null;
  ip_hash: string;
}

export interface EditRow {
  id: string;
  created_at: number;
  entity_type: EntityType;
  entity_id: string;
  before_json: string;
  after_json: string;
  changes_json: string;
  source_url: string;
  checker_result_json: string | null;
  status: EditStatus;
  tier: EditTier;
  decided_at: number | null;
  decided_by: string | null;
}

export interface AuditRow {
  id: string;
  created_at: number;
  actor_email: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details_json: string | null;
}

export interface D1Like {
  exec(sql: string): Promise<unknown>;
  prepare(sql: string): {
    bind(...values: Array<string | number | null>): {
      first<T extends Record<string, unknown>>(): Promise<T | null>;
      all<T extends Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
}

export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, args: Array<string | number | null>): Promise<void>;
  get<T extends Record<string, unknown>>(sql: string, args: Array<string | number | null>): Promise<T | null>;
  all<T extends Record<string, unknown>>(sql: string, args: Array<string | number | null>): Promise<T[]>;
}

export function createSqlExecutor(db: D1Like): SqlExecutor {
  return {
    exec: async (sql) => {
      await db.exec(sql);
    },
    run: async (sql, args) => {
      await db.prepare(sql).bind(...args).run();
    },
    get: async (sql, args) => (await db.prepare(sql).bind(...args).first()) ?? null,
    all: async <T extends Record<string, unknown>>(sql: string, args: Array<string | number | null>) => {
      const result = await db.prepare(sql).bind(...args).all<T>();
      return result.results;
    },
  };
}
