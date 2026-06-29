-- outreach_settings: singleton config row (always id=1).
-- slack_webhook_url stored server-side, never exposed to browser (D-26).
-- voice_sample is plain-text; hard-deleted on request (D-30).
CREATE TABLE IF NOT EXISTS outreach_settings (
  id               INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cooldown_days    INTEGER NOT NULL DEFAULT 21,
  slack_webhook_url TEXT,
  voice_sample     TEXT,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO outreach_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- trigger_rules: one row per trigger the founder defines.
-- rules_met_min / rules_total encode "when rulesMet >= rules_met_min out of rules_total".
CREATE TABLE IF NOT EXISTS trigger_rules (
  id             SERIAL PRIMARY KEY,
  label          TEXT NOT NULL,
  rules_met_min  INTEGER NOT NULL,
  rules_total    INTEGER NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- trigger_domain_state: one row per (trigger_rule_id, domain) pair.
-- re_arm_eligible flips to true when score drops below threshold after a send/dismiss.
-- Allows re-draft only after genuine dip-and-recross (D-27).
CREATE TABLE IF NOT EXISTS trigger_domain_state (
  trigger_rule_id INTEGER NOT NULL REFERENCES trigger_rules(id) ON DELETE CASCADE,
  domain          TEXT NOT NULL,
  re_arm_eligible BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (trigger_rule_id, domain)
);

-- outreach_drafts: one row per draft instance.
-- generated_text = LLM output; draft_text = founder-editable copy (starts equal).
-- status: pending → sent | dismissed.
CREATE TABLE IF NOT EXISTS outreach_drafts (
  id               SERIAL PRIMARY KEY,
  domain           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'dismissed')),
  generated_text   TEXT NOT NULL,
  draft_text       TEXT NOT NULL,
  fact_block       TEXT NOT NULL,
  created_by       TEXT NOT NULL CHECK (created_by IN ('trigger', 'manual')),
  trigger_rule_id  INTEGER REFERENCES trigger_rules(id) ON DELETE SET NULL,
  triggered_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  dismissed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- outreach_log: one row per send or copy action (D-28).
-- draft_text_snapshot captures what actually went out — founder's edited version.
CREATE TABLE IF NOT EXISTS outreach_log (
  id                   SERIAL PRIMARY KEY,
  draft_id             INTEGER NOT NULL REFERENCES outreach_drafts(id),
  domain               TEXT NOT NULL,
  channel              TEXT NOT NULL CHECK (channel IN ('slack', 'clipboard_copied')),
  recipient            TEXT,
  draft_text_snapshot  TEXT NOT NULL,
  created_by           TEXT NOT NULL CHECK (created_by IN ('trigger', 'manual')),
  trigger_rule_id      INTEGER REFERENCES trigger_rules(id) ON DELETE SET NULL,
  actioned_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- suppression_list: hard blocks — no draft or send if domain or email matches.
-- Soft-deleted (removed_at) to preserve compliance audit trail (D-29).
CREATE TABLE IF NOT EXISTS suppression_list (
  id          SERIAL PRIMARY KEY,
  entry_type  TEXT NOT NULL CHECK (entry_type IN ('domain', 'email')),
  value       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS suppression_list_active_value
  ON suppression_list (value)
  WHERE removed_at IS NULL;
