CREATE TABLE IF NOT EXISTS funnels (
  id         SERIAL      PRIMARY KEY,
  name       TEXT        NOT NULL,
  mode       TEXT        NOT NULL CHECK (mode IN ('user', 'company')),
  window_days INT        NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS funnel_steps (
  id         SERIAL      PRIMARY KEY,
  funnel_id  INT         NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  position   INT         NOT NULL,
  event_name TEXT        NOT NULL,
  UNIQUE (funnel_id, position)
);
