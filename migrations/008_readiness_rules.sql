-- D-19/D-21: typed readiness rules — one condition per signal, no free-form SQL.
-- signal must be one of the five known-safe types; operator constrained to >= / <=.
CREATE TABLE IF NOT EXISTS readiness_rules (
  id          SERIAL      PRIMARY KEY,
  label       TEXT        NOT NULL,
  signal      TEXT        NOT NULL
                          CHECK (signal IN (
                            'active_users',
                            'total_events',
                            'days_since_active',
                            'key_event_fired',
                            'days_in_product'
                          )),
  operator    TEXT        NOT NULL CHECK (operator IN ('>=', '<=')),
  threshold   NUMERIC     NOT NULL,
  window_days INT,
  event_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Five default rules — one per signal type with conservative thresholds.
INSERT INTO readiness_rules (label, signal, operator, threshold, window_days, event_name) VALUES
  ('Active users ≥ 3 (last 30d)',      'active_users',     '>=', 3,  30, NULL),
  ('Total events ≥ 20 (last 7d)',      'total_events',     '>=', 20,  7, NULL),
  ('Active in last 14 days',           'days_since_active','<=', 14, NULL, NULL),
  ('Key event fired',                  'key_event_fired',  '>=', 1,  NULL, 'payment_intent'),
  ('In product ≥ 7 days',             'days_in_product',  '>=', 7,  NULL, NULL)
ON CONFLICT DO NOTHING;
