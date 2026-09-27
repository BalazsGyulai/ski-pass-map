-- Migration number: 0001
-- Description: App database (contact, rate limits, edits, audit)

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  lang TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'data-error', 'resort-owner', 'privacy', 'other')),
  resort_id TEXT,
  email TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'flagged', 'done', 'spam')),
  flag_reason TEXT,
  ip_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created ON contact_messages (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_flagged ON contact_messages (created_at DESC) WHERE status = 'flagged';

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS edits (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('resort', 'pass')),
  entity_id TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  changes_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  checker_result_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto-published')),
  tier TEXT NOT NULL CHECK (tier IN ('A', 'B', 'C')),
  decided_at INTEGER,
  decided_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_edits_status_created ON edits (status, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
