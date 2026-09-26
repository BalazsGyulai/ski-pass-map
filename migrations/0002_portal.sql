-- Migration number: 0002
-- Description: Resort self-service portal (accounts, sessions, invites, promos, runtime overrides)

CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  email_lower TEXT NOT NULL UNIQUE,
  display_name TEXT,
  terms_version TEXT NOT NULL,
  terms_accepted_at INTEGER NOT NULL,
  webauthn_user_id TEXT NOT NULL UNIQUE,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_credentials (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_credentials_user ON portal_credentials (user_id);

CREATE TABLE IF NOT EXISTS portal_user_resorts (
  user_id TEXT NOT NULL,
  resort_id TEXT NOT NULL,
  PRIMARY KEY (user_id, resort_id)
);

CREATE TABLE IF NOT EXISTS portal_invites (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  resort_ids_json TEXT NOT NULL,
  verified_domain TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by_user_id TEXT,
  created_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_user ON portal_sessions (user_id);

CREATE TABLE IF NOT EXISTS portal_challenges (
  id TEXT PRIMARY KEY NOT NULL,
  challenge TEXT NOT NULL,
  user_id TEXT,
  email_lower TEXT,
  invite_id TEXT,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS promos (
  id TEXT PRIMARY KEY NOT NULL,
  resort_id TEXT NOT NULL,
  text TEXT NOT NULL,
  link_url TEXT,
  logo_url TEXT,
  owner_licence_accepted INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_promos_resort_status ON promos (resort_id, status);

CREATE TABLE IF NOT EXISTS resort_listing (
  resort_id TEXT PRIMARY KEY NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('full', 'link_only', 'unlisted')),
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runtime_overrides (
  resort_id TEXT PRIMARY KEY NOT NULL,
  fields_json TEXT NOT NULL,
  attribution_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  edit_id TEXT,
  published_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS portal_daily_limits (
  resort_id TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  field_count INTEGER NOT NULL,
  PRIMARY KEY (resort_id, day_utc)
);

ALTER TABLE edits ADD COLUMN submitted_by TEXT;
ALTER TABLE edits ADD COLUMN rejection_reason TEXT;
ALTER TABLE edits ADD COLUMN rollback_reason TEXT;
ALTER TABLE edits ADD COLUMN attribution_json TEXT;
