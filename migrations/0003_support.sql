-- Support perk codes from Ko-fi webhook (no donor PII).

CREATE TABLE IF NOT EXISTS support_codes (
  kofi_transaction_id TEXT PRIMARY KEY NOT NULL,
  code_hash TEXT NOT NULL,
  code_plain TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_codes_expires ON support_codes (expires_at);

CREATE TABLE IF NOT EXISTS page_stats (
  day_utc TEXT NOT NULL,
  path TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day_utc, path)
);
