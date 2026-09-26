import type { SqlExecutor } from "./types";
import type { ListingMode } from "@/lib/portal/listing";
import type { EditRow, EditStatus, EditTier } from "./types";

export interface PortalUserRow {
  id: string;
  email: string;
  email_lower: string;
  display_name: string | null;
  terms_version: string;
  terms_accepted_at: number;
  webauthn_user_id: string;
  totp_secret: string | null;
  totp_enabled: number;
  created_at: number;
}

export interface PortalInviteRow {
  id: string;
  token_hash: string;
  email: string;
  resort_ids_json: string;
  verified_domain: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by_user_id: string | null;
  created_by: string;
}

export interface PortalSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_token: string;
  created_at: number;
  expires_at: number;
}

export interface PromoRow {
  id: string;
  resort_id: string;
  text: string;
  link_url: string | null;
  logo_url: string | null;
  owner_licence_accepted: number;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  submitted_by: string;
  created_at: number;
  decided_at: number | null;
  decided_by: string | null;
}

export interface PortalStore {
  insertInvite(row: PortalInviteRow): Promise<void>;
  getInviteByTokenHash(hash: string): Promise<PortalInviteRow | null>;
  getInviteById(id: string): Promise<PortalInviteRow | null>;
  markInviteUsed(id: string, userId: string, usedAt: number): Promise<void>;
  listInvites(limit: number): Promise<PortalInviteRow[]>;
  insertUser(row: PortalUserRow): Promise<void>;
  getUserByEmail(emailLower: string): Promise<PortalUserRow | null>;
  getUserById(id: string): Promise<PortalUserRow | null>;
  listPortalUsers(limit: number): Promise<PortalUserRow[]>;
  setUserResorts(userId: string, resortIds: string[]): Promise<void>;
  listUserResortIds(userId: string): Promise<string[]>;
  insertCredential(row: { id: string; user_id: string; credential_id: string; public_key: string; counter: number; transports: string | null; created_at: number }): Promise<void>;
  getCredentialById(credentialId: string): Promise<{ id: string; user_id: string; credential_id: string; public_key: string; counter: number } | null>;
  updateCredentialCounter(id: string, counter: number): Promise<void>;
  insertSession(row: PortalSessionRow): Promise<void>;
  getSessionById(id: string): Promise<PortalSessionRow | null>;
  deleteSession(id: string): Promise<void>;
  insertChallenge(row: { id: string; challenge: string; user_id: string | null; email_lower: string | null; invite_id: string | null; expires_at: number }): Promise<void>;
  getChallenge(id: string): Promise<{ id: string; challenge: string; user_id: string | null; email_lower: string | null; invite_id: string | null; expires_at: number } | null>;
  deleteChallenge(id: string): Promise<void>;
  bumpDailyFieldCount(resortId: string, dayUtc: string, delta: number): Promise<number>;
  upsertRuntimeOverride(resortId: string, fieldsJson: string, attributionJson: string, sourceUrl: string, editId: string | null, publishedAt: number): Promise<void>;
  deleteRuntimeOverride(resortId: string): Promise<void>;
  listRuntimeOverrides(): Promise<Array<{ resort_id: string; fields_json: string; attribution_json: string; source_url: string; edit_id: string | null; published_at: number }>>;
  setListingMode(resortId: string, mode: ListingMode, updatedAt: number, updatedBy: string): Promise<void>;
  listListingModes(): Promise<Array<{ resort_id: string; mode: ListingMode }>>;
  insertPromo(row: PromoRow): Promise<void>;
  listPromos(status?: PromoRow["status"]): Promise<PromoRow[]>;
  setPromoStatus(id: string, status: PromoRow["status"], decidedBy: string, rejectionReason?: string | null): Promise<void>;
  getApprovedPromoForResort(resortId: string): Promise<PromoRow | null>;
  insertPortalEdit(row: Omit<EditRow, "decided_at" | "decided_by" | "checker_result_json"> & {
    checker_result_json?: string | null;
    submitted_by: string;
    attribution_json?: string | null;
  }): Promise<void>;
  setEditRejection(id: string, reason: string, decidedBy: string): Promise<void>;
  setEditRollback(id: string, reason: string, decidedBy: string): Promise<void>;
  listEditsByTierStatus(tier: EditTier, status: EditStatus): Promise<EditRow[]>;
}

function mapUser(row: Record<string, unknown>): PortalUserRow {
  return {
    id: String(row.id),
    email: String(row.email),
    email_lower: String(row.email_lower),
    display_name: row.display_name == null ? null : String(row.display_name),
    terms_version: String(row.terms_version),
    terms_accepted_at: Number(row.terms_accepted_at),
    webauthn_user_id: String(row.webauthn_user_id),
    totp_secret: row.totp_secret == null ? null : String(row.totp_secret),
    totp_enabled: Number(row.totp_enabled),
    created_at: Number(row.created_at),
  };
}

function mapPromo(row: Record<string, unknown>): PromoRow {
  return {
    id: String(row.id),
    resort_id: String(row.resort_id),
    text: String(row.text),
    link_url: row.link_url == null ? null : String(row.link_url),
    logo_url: row.logo_url == null ? null : String(row.logo_url),
    owner_licence_accepted: Number(row.owner_licence_accepted),
    status: row.status as PromoRow["status"],
    rejection_reason: row.rejection_reason == null ? null : String(row.rejection_reason),
    submitted_by: String(row.submitted_by),
    created_at: Number(row.created_at),
    decided_at: row.decided_at == null ? null : Number(row.decided_at),
    decided_by: row.decided_by == null ? null : String(row.decided_by),
  };
}

function mapInvite(row: Record<string, unknown>): PortalInviteRow {
  return {
    id: String(row.id),
    token_hash: String(row.token_hash),
    email: String(row.email),
    resort_ids_json: String(row.resort_ids_json),
    verified_domain: row.verified_domain == null ? null : String(row.verified_domain),
    created_at: Number(row.created_at),
    expires_at: Number(row.expires_at),
    used_at: row.used_at == null ? null : Number(row.used_at),
    used_by_user_id: row.used_by_user_id == null ? null : String(row.used_by_user_id),
    created_by: String(row.created_by),
  };
}

export function createPortalStore(sql: SqlExecutor): PortalStore {
  return {
    async insertInvite(row) {
      await sql.run(
        `INSERT INTO portal_invites (id, token_hash, email, resort_ids_json, verified_domain, created_at, expires_at, used_at, used_by_user_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
        [row.id, row.token_hash, row.email, row.resort_ids_json, row.verified_domain, row.created_at, row.expires_at, row.created_by],
      );
    },
    async getInviteByTokenHash(hash) {
      const row = await sql.get(`SELECT * FROM portal_invites WHERE token_hash = ?`, [hash]);
      return row ? mapInvite(row) : null;
    },
    async getInviteById(id) {
      const row = await sql.get(`SELECT * FROM portal_invites WHERE id = ?`, [id]);
      return row ? mapInvite(row) : null;
    },
    async markInviteUsed(id, userId, usedAt) {
      await sql.run(`UPDATE portal_invites SET used_at = ?, used_by_user_id = ? WHERE id = ?`, [usedAt, userId, id]);
    },
    async listInvites(limit) {
      const rows = await sql.all(`SELECT * FROM portal_invites ORDER BY created_at DESC LIMIT ?`, [limit]);
      return rows.map(mapInvite);
    },
    async insertUser(row) {
      await sql.run(
        `INSERT INTO portal_users (id, email, email_lower, display_name, terms_version, terms_accepted_at, webauthn_user_id, totp_secret, totp_enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.email,
          row.email_lower,
          row.display_name,
          row.terms_version,
          row.terms_accepted_at,
          row.webauthn_user_id,
          row.totp_secret,
          row.totp_enabled,
          row.created_at,
        ],
      );
    },
    async getUserByEmail(emailLower) {
      const row = await sql.get(`SELECT * FROM portal_users WHERE email_lower = ?`, [emailLower]);
      return row ? mapUser(row) : null;
    },
    async getUserById(id) {
      const row = await sql.get(`SELECT * FROM portal_users WHERE id = ?`, [id]);
      return row ? mapUser(row) : null;
    },
    async listPortalUsers(limit) {
      const rows = await sql.all(`SELECT * FROM portal_users ORDER BY created_at DESC LIMIT ?`, [limit]);
      return rows.map(mapUser);
    },
    async setUserResorts(userId, resortIds) {
      await sql.run(`DELETE FROM portal_user_resorts WHERE user_id = ?`, [userId]);
      for (const resortId of resortIds) {
        await sql.run(`INSERT INTO portal_user_resorts (user_id, resort_id) VALUES (?, ?)`, [userId, resortId]);
      }
    },
    async listUserResortIds(userId) {
      const rows = await sql.all<{ resort_id: string }>(`SELECT resort_id FROM portal_user_resorts WHERE user_id = ?`, [userId]);
      return rows.map((r) => r.resort_id);
    },
    async insertCredential(row) {
      await sql.run(
        `INSERT INTO portal_credentials (id, user_id, credential_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.user_id, row.credential_id, row.public_key, row.counter, row.transports, row.created_at],
      );
    },
    async getCredentialById(credentialId) {
      return sql.get(`SELECT id, user_id, credential_id, public_key, counter FROM portal_credentials WHERE credential_id = ?`, [credentialId]);
    },
    async updateCredentialCounter(id, counter) {
      await sql.run(`UPDATE portal_credentials SET counter = ? WHERE id = ?`, [counter, id]);
    },
    async insertSession(row) {
      await sql.run(
        `INSERT INTO portal_sessions (id, user_id, token_hash, csrf_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.user_id, row.token_hash, row.csrf_token, row.created_at, row.expires_at],
      );
    },
    async getSessionById(id) {
      const row = await sql.get(`SELECT * FROM portal_sessions WHERE id = ?`, [id]);
      if (!row) return null;
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        token_hash: String(row.token_hash),
        csrf_token: String(row.csrf_token),
        created_at: Number(row.created_at),
        expires_at: Number(row.expires_at),
      };
    },
    async deleteSession(id) {
      await sql.run(`DELETE FROM portal_sessions WHERE id = ?`, [id]);
    },
    async insertChallenge(row) {
      await sql.run(
        `INSERT INTO portal_challenges (id, challenge, user_id, email_lower, invite_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.challenge, row.user_id, row.email_lower, row.invite_id, row.expires_at],
      );
    },
    async getChallenge(id) {
      return sql.get(`SELECT * FROM portal_challenges WHERE id = ?`, [id]);
    },
    async deleteChallenge(id) {
      await sql.run(`DELETE FROM portal_challenges WHERE id = ?`, [id]);
    },
    async bumpDailyFieldCount(resortId, dayUtc, delta) {
      const existing = await sql.get<{ field_count: number }>(
        `SELECT field_count FROM portal_daily_limits WHERE resort_id = ? AND day_utc = ?`,
        [resortId, dayUtc],
      );
      const next = (existing?.field_count ?? 0) + delta;
      await sql.run(
        `INSERT INTO portal_daily_limits (resort_id, day_utc, field_count) VALUES (?, ?, ?)
         ON CONFLICT(resort_id, day_utc) DO UPDATE SET field_count = ?`,
        [resortId, dayUtc, next, next],
      );
      return next;
    },
    async upsertRuntimeOverride(resortId, fieldsJson, attributionJson, sourceUrl, editId, publishedAt) {
      await sql.run(
        `INSERT INTO runtime_overrides (resort_id, fields_json, attribution_json, source_url, edit_id, published_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(resort_id) DO UPDATE SET fields_json = ?, attribution_json = ?, source_url = ?, edit_id = ?, published_at = ?`,
        [resortId, fieldsJson, attributionJson, sourceUrl, editId, publishedAt, fieldsJson, attributionJson, sourceUrl, editId, publishedAt],
      );
    },
    async deleteRuntimeOverride(resortId) {
      await sql.run(`DELETE FROM runtime_overrides WHERE resort_id = ?`, [resortId]);
    },
    async listRuntimeOverrides() {
      return sql.all(`SELECT * FROM runtime_overrides`, []);
    },
    async setListingMode(resortId, mode, updatedAt, updatedBy) {
      await sql.run(
        `INSERT INTO resort_listing (resort_id, mode, updated_at, updated_by) VALUES (?, ?, ?, ?)
         ON CONFLICT(resort_id) DO UPDATE SET mode = ?, updated_at = ?, updated_by = ?`,
        [resortId, mode, updatedAt, updatedBy, mode, updatedAt, updatedBy],
      );
    },
    async listListingModes() {
      const rows = await sql.all(`SELECT resort_id, mode FROM resort_listing`, []);
      return rows.map((row) => ({ resort_id: String(row.resort_id), mode: row.mode as ListingMode }));
    },
    async insertPromo(row) {
      await sql.run(
        `INSERT INTO promos (id, resort_id, text, link_url, logo_url, owner_licence_accepted, status, rejection_reason, submitted_by, created_at, decided_at, decided_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, NULL)`,
        [
          row.id,
          row.resort_id,
          row.text,
          row.link_url,
          row.logo_url,
          row.owner_licence_accepted,
          row.status,
          row.submitted_by,
          row.created_at,
        ],
      );
    },
    async listPromos(status) {
      const rows = status
        ? await sql.all(`SELECT * FROM promos WHERE status = ? ORDER BY created_at DESC`, [status])
        : await sql.all(`SELECT * FROM promos ORDER BY created_at DESC`, []);
      return rows.map(mapPromo);
    },
    async setPromoStatus(id, status, decidedBy, rejectionReason) {
      await sql.run(`UPDATE promos SET status = ?, decided_at = ?, decided_by = ?, rejection_reason = ? WHERE id = ?`, [
        status,
        Date.now(),
        decidedBy,
        rejectionReason ?? null,
        id,
      ]);
    },
    async getApprovedPromoForResort(resortId) {
      const row = await sql.get(`SELECT * FROM promos WHERE resort_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 1`, [resortId]);
      return row ? mapPromo(row) : null;
    },
    async insertPortalEdit(row) {
      await sql.run(
        `INSERT INTO edits (id, created_at, entity_type, entity_id, before_json, after_json, changes_json, source_url, checker_result_json, status, tier, decided_at, decided_by, submitted_by, rejection_reason, rollback_reason, attribution_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, ?)`,
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
          row.submitted_by,
          row.attribution_json ?? null,
        ],
      );
    },
    async setEditRejection(id, reason, decidedBy) {
      await sql.run(`UPDATE edits SET status = 'rejected', rejection_reason = ?, decided_at = ?, decided_by = ? WHERE id = ?`, [
        reason,
        Date.now(),
        decidedBy,
        id,
      ]);
    },
    async setEditRollback(id, reason, decidedBy) {
      await sql.run(`UPDATE edits SET status = 'rejected', rollback_reason = ?, decided_at = ?, decided_by = ? WHERE id = ?`, [
        reason,
        Date.now(),
        decidedBy,
        id,
      ]);
    },
    async listEditsByTierStatus(tier, status) {
      const rows = await sql.all(`SELECT * FROM edits WHERE tier = ? AND status = ? ORDER BY created_at DESC`, [tier, status]);
      return rows.map((row) => ({
        id: String(row.id),
        created_at: Number(row.created_at),
        entity_type: row.entity_type as EditRow["entity_type"],
        entity_id: String(row.entity_id),
        before_json: String(row.before_json),
        after_json: String(row.after_json),
        changes_json: String(row.changes_json),
        source_url: String(row.source_url),
        checker_result_json: row.checker_result_json == null ? null : String(row.checker_result_json),
        status: row.status as EditRow["status"],
        tier: row.tier as EditRow["tier"],
        decided_at: row.decided_at == null ? null : Number(row.decided_at),
        decided_by: row.decided_by == null ? null : String(row.decided_by),
      }));
    },
  };
}
