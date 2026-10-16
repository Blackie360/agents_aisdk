-- Run once in the connected Neon database. Contains no user schemas or keys.
CREATE TABLE IF NOT EXISTS schemamind_usage_events (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('visualization', 'explanation')),
  outcome text NOT NULL CHECK (outcome IN ('success', 'failure')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schemamind_usage_events_created_at_idx
  ON schemamind_usage_events (created_at);
