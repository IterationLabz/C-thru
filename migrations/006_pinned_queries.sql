CREATE TABLE IF NOT EXISTS pinned_queries (
  id          SERIAL      PRIMARY KEY,
  question    TEXT        NOT NULL,
  sql         TEXT        NOT NULL,
  pinned_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
