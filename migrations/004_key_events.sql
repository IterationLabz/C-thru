CREATE TABLE IF NOT EXISTS key_events (
  name        TEXT        PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
