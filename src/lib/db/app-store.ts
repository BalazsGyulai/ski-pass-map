import type {
  AuditRow,
  ContactCategory,
  ContactMessageRow,
  ContactStatus,
  EditRow,
  EditStatus,
  EditTier,
  EntityType,
  SqlExecutor,
} from "./types";

export const RATE_DELETE_EXPIRED = `DELETE FROM rate_limits WHERE expires_at <= ?`;

export const RATE_UPSERT = `INSERT INTO rate_limits (bucket, hits, expires_at) VALUES (?, 1, ?)
ON CONFLICT(bucket) DO UPDATE SET
  hits = CASE WHEN rate_limits.expires_at <= ? THEN 1 ELSE rate_limits.hits + 1 END,
  expires_at = CASE WHEN rate_limits.expires_at <= ? THEN ? ELSE rate_limits.expires_at END
RETURNING hits`;

export interface AppStore {
  insertContact(row: Omit<ContactMessageRow, "status" | "flag_reason"> & { status: ContactStatus; flag_reason: string | null }): Promise<void>;
  listContacts(filter?: { status?: ContactStatus }): Promise<ContactMessageRow[]>;
  updateContactStatus(id: string, status: ContactStatus): Promise<boolean>;
  bumpRate(bucket: string, nowMs: number, expiresMs: number): Promise<number>;
  insertEdit(row: Omit<EditRow, "checker_result_json" | "decided_at" | "decided_by"> & { checker_result_json?: string | null }): Promise<void>;
  listEdits(status?: EditStatus): Promise<EditRow[]>;
  getEdit(id: string): Promise<EditRow | null>;
  setEditStatus(id: string, status: EditStatus, decidedBy: string, checkerResultJson?: string | null): Promise<boolean>;
  insertAudit(row: Omit<AuditRow, "id"> & { id: string }): Promise<void>;
  listAudit(limit: number): Promise<AuditRow[]>;
}

function mapContact(row: Record<string, unknown>): ContactMessageRow {
  return {
    id: String(row.id),
    created_at: Number(row.created_at),
    lang: String(row.lang),
    category: row.category as ContactMessageRow["category"],
    resort_id: row.resort_id == null ? null : String(row.resort_id),
    email: row.email == null ? null : String(row.email),
    message: String(row.message),
    status: row.status as ContactStatus,
    flag_reason: row.flag_reason == null ? null : String(row.flag_reason),
    ip_hash: String(row.ip_hash),
  };
}

function mapEdit(row: Record<string, unknown>): EditRow {
  return {
    id: String(row.id),
    created_at: Number(row.created_at),
    entity_type: row.entity_type as EntityType,
    entity_id: String(row.entity_id),
    before_json: String(row.before_json),
    after_json: String(row.after_json),
    changes_json: String(row.changes_json),
    source_url: String(row.source_url),
    checker_result_json: row.checker_result_json == null ? null : String(row.checker_result_json),
    status: row.status as EditStatus,
    tier: row.tier as EditTier,
    decided_at: row.decided_at == null ? null : Number(row.decided_at),
    decided_by: row.decided_by == null ? null : String(row.decided_by),
  };
}

export function createAppStore(sql: SqlExecutor): AppStore {
  return {
    async insertContact(row) {
      await sql.run(
        `INSERT INTO contact_messages (id, created_at, lang, category, resort_id, email, message, status, flag_reason, ip_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.created_at,
          row.lang,
          row.category,
          row.resort_id,
          row.email,
          row.message,
          row.status,
          row.flag_reason,
          row.ip_hash,
        ],
      );
    },
    async listContacts(filter) {
      const rows = filter?.status
        ? await sql.all(`SELECT * FROM contact_messages WHERE status = ? ORDER BY created_at DESC`, [filter.status])
        : await sql.all(
            `SELECT * FROM contact_messages ORDER BY CASE status WHEN 'flagged' THEN 0 WHEN 'new' THEN 1 ELSE 2 END, created_at DESC`,
            [],
          );
      return rows.map(mapContact);
    },
    async updateContactStatus(id, status) {
      await sql.run(`UPDATE contact_messages SET status = ? WHERE id = ?`, [status, id]);
      const row = await sql.get(`SELECT id FROM contact_messages WHERE id = ?`, [id]);
      return row != null;
    },
    async bumpRate(bucket, nowMs, expiresMs) {
      await sql.run(RATE_DELETE_EXPIRED, [nowMs]);
      const expires = nowMs + expiresMs;
      const row = await sql.get<{ hits: number }>(RATE_UPSERT, [bucket, expires, nowMs, nowMs, expires]);
      return row?.hits ?? 1;
    },
    async insertEdit(row) {
      await sql.run(
        `INSERT INTO edits (id, created_at, entity_type, entity_id, before_json, after_json, changes_json, source_url, checker_result_json, status, tier, decided_at, decided_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
        [
          row.id,
          row.created_at,
          row.entity_type,
          row.entity_id,
          row.before_json,
          row.after_json,
          row.changes_json,
          row.source_url,
          row.checker_result_json ?? null,
          row.status,
          row.tier,
        ],
      );
    },
    async listEdits(status) {
      const rows = status
        ? await sql.all(`SELECT * FROM edits WHERE status = ? ORDER BY created_at DESC`, [status])
        : await sql.all(`SELECT * FROM edits ORDER BY created_at DESC`, []);
      return rows.map(mapEdit);
    },
    async getEdit(id) {
      const row = await sql.get(`SELECT * FROM edits WHERE id = ?`, [id]);
      return row ? mapEdit(row) : null;
    },
    async setEditStatus(id, status, decidedBy, checkerResultJson) {
      const now = Date.now();
      if (checkerResultJson !== undefined) {
        await sql.run(`UPDATE edits SET status = ?, decided_at = ?, decided_by = ?, checker_result_json = ? WHERE id = ?`, [
          status,
          now,
          decidedBy,
          checkerResultJson,
          id,
        ]);
      } else {
        await sql.run(`UPDATE edits SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?`, [status, now, decidedBy, id]);
      }
      const row = await sql.get(`SELECT id FROM edits WHERE id = ?`, [id]);
      return row != null;
    },
    async insertAudit(row) {
      await sql.run(
        `INSERT INTO audit_log (id, created_at, actor_email, action, entity_type, entity_id, details_json) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.created_at, row.actor_email, row.action, row.entity_type, row.entity_id, row.details_json],
      );
    },
    async listAudit(limit) {
      const rows = await sql.all(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?`, [limit]);
      return rows.map((row) => ({
        id: String(row.id),
        created_at: Number(row.created_at),
        actor_email: String(row.actor_email),
        action: String(row.action),
        entity_type: row.entity_type == null ? null : String(row.entity_type),
        entity_id: row.entity_id == null ? null : String(row.entity_id),
        details_json: row.details_json == null ? null : String(row.details_json),
      }));
    },
  };
}

export function autoFlagContact(category: ContactCategory, resortId: string | null | undefined): { status: ContactStatus; flag_reason: string | null } {
  if (category === "data-error" || category === "resort-owner") {
    return { status: "flagged", flag_reason: `category:${category}` };
  }
  if (resortId && resortId.trim()) {
    return { status: "flagged", flag_reason: "resort-id" };
  }
  return { status: "new", flag_reason: null };
}
