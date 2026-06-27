CREATE TABLE IF NOT EXISTS events (
  id               BIGSERIAL   PRIMARY KEY,
  name             TEXT        NOT NULL,
  source           TEXT        NOT NULL CHECK (source IN ('auto', 'custom', 'server')),
  properties       JSONB       NOT NULL DEFAULT '{}',
  user_id          TEXT,
  email            TEXT,
  company_domain   TEXT,
  session_id       TEXT,
  anonymous_id     TEXT        NOT NULL,
  url              TEXT,
  referrer         TEXT,
  device           JSONB,
  occurred_at      TIMESTAMPTZ NOT NULL,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurred_at_suspect BOOLEAN  NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_events_name     ON events (name);
CREATE INDEX IF NOT EXISTS idx_events_company  ON events (company_domain);
CREATE INDEX IF NOT EXISTS idx_events_user     ON events (user_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred ON events (occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_props    ON events USING GIN (properties);

CREATE OR REPLACE VIEW events_v AS
  SELECT *,
    CASE WHEN occurred_at_suspect
      THEN received_at
      ELSE occurred_at
    END AS occurred_at_effective
  FROM events;
