-- Monthly Mapbox map-load counter. The Pages function also creates these tables
-- on first use. Apply this file yourself if you want the schema before the
-- first request:
--   npx wrangler d1 execute skimap-map-loads --file=functions/schema.sql
-- Do not run that from CI, and do not create the database from this repo.

CREATE TABLE IF NOT EXISTS map_loads (
  month TEXT PRIMARY KEY,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_buckets (
  bucket TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
