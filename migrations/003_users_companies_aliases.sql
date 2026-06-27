CREATE TABLE IF NOT EXISTS users (
  user_id      TEXT        PRIMARY KEY,
  email        TEXT,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
  domain       TEXT        PRIMARY KEY,
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aliases (
  anonymous_id    TEXT        PRIMARY KEY,
  user_id         TEXT,
  email           TEXT,
  company_domain  TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aliases_user_id ON aliases (user_id);
