-- Run once in the connected Neon database (same one as 001_usage.sql).
-- Shared rate-limit counters for /api/schema-explanation and /api/admin/usage.
-- Buckets hold a rule name, a hashed IP (or "global") and a window start; no raw IPs, schemas or keys.
CREATE TABLE IF NOT EXISTS schemamind_rate_limits (
  bucket text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS schemamind_rate_limits_expires_at_idx
  ON schemamind_rate_limits (expires_at);
