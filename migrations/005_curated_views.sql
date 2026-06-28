-- signups_v: one row per identified user.
-- "Signup" = first time a user_id appeared in the system (users.first_seen).
-- company_domain derived from users.email at query time via blocked_domains check —
-- deterministic, not captured at a point in time, not sourced from alias recency.
-- Window filtering (e.g. "last 7 days") happens in generated queries: WHERE signed_up_at >= ...
CREATE OR REPLACE VIEW signups_v AS
SELECT
  u.user_id,
  u.email,
  CASE
    WHEN u.email LIKE '%@%' AND bd.domain IS NULL
    THEN lower(split_part(u.email, '@', 2))
    ELSE NULL
  END           AS company_domain,
  u.first_seen  AS signed_up_at,
  u.last_seen
FROM users u
LEFT JOIN blocked_domains bd
  ON bd.domain = lower(split_part(u.email, '@', 2));

-- active_users_v: one row per identified user who has at least one event.
-- "Active" is NOT baked into this view — it exposes per-user last_event_at so the
-- window filter (7d/30d) happens in the generated query: WHERE last_event_at >= ...
-- Uses received_at (not occurred_at_effective) for the recency signal — "when did
-- we actually hear from this user?" is the honest activity question.
-- company_domain uses the same users.email → blocked_domains logic as signups_v
-- so "active users from company X" is consistent with "signups from company X".
-- Multi-device users (multiple anonymous_ids) are collapsed by GROUP BY user_id.
CREATE OR REPLACE VIEW active_users_v AS
SELECT
  a.user_id,
  u.email,
  CASE
    WHEN u.email LIKE '%@%' AND bd.domain IS NULL
    THEN lower(split_part(u.email, '@', 2))
    ELSE NULL
  END                AS company_domain,
  MAX(e.received_at) AS last_event_at,
  COUNT(*)           AS total_events
FROM aliases a
JOIN events_v e       ON a.anonymous_id = e.anonymous_id
LEFT JOIN users u     ON a.user_id = u.user_id
LEFT JOIN blocked_domains bd
  ON bd.domain = lower(split_part(u.email, '@', 2))
WHERE a.user_id IS NOT NULL
GROUP BY a.user_id, u.email, bd.domain;

-- company_activity_v: one row per company domain, personal domains excluded.
-- Uses COALESCE(e.company_domain, a.company_domain) for retroactive attribution:
-- pre-login events (e.company_domain = NULL) get attributed to the company once
-- the user identifies and the alias is populated.
-- The blocked_domains join filters on the COALESCE'd result so that:
--   (a) domains added to the blocklist after ingestion are immediately excluded
--       (consistent with signups_v / active_users_v which classify at query time), and
--   (b) retroactive attribution still works — pre-login events are attributed first
--       via COALESCE, then the blocklist is checked on that resolved domain.
-- last_event_at uses received_at for consistency with active_users_v.
-- identified_users counts distinct user_ids (NULLs excluded by COUNT DISTINCT).
CREATE OR REPLACE VIEW company_activity_v AS
SELECT
  COALESCE(e.company_domain, a.company_domain)  AS domain,
  COUNT(*)                                        AS total_events,
  MAX(e.received_at)                              AS last_event_at,
  COUNT(DISTINCT e.anonymous_id)                  AS unique_visitors,
  COUNT(DISTINCT a.user_id)                       AS identified_users
FROM events_v e
LEFT JOIN aliases a ON e.anonymous_id = a.anonymous_id
LEFT JOIN blocked_domains bd
  ON bd.domain = COALESCE(e.company_domain, a.company_domain)
WHERE COALESCE(e.company_domain, a.company_domain) IS NOT NULL
  AND bd.domain IS NULL
GROUP BY COALESCE(e.company_domain, a.company_domain);

-- cthru_readonly: read-only Postgres role for executing LLM-generated queries.
-- Granted SELECT on curated views only — NOT on raw events table.
-- Defense-in-depth beneath the AST guard (Issue #4): even if validation misses
-- something, a write or raw-table read fails at the DB level.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cthru_readonly') THEN
    CREATE ROLE cthru_readonly LOGIN PASSWORD 'cthru_readonly';
  END IF;
END $$;

GRANT SELECT ON events_v TO cthru_readonly;
GRANT SELECT ON signups_v TO cthru_readonly;
GRANT SELECT ON active_users_v TO cthru_readonly;
GRANT SELECT ON company_activity_v TO cthru_readonly;

-- Allow the cthru app user to SET ROLE cthru_readonly (needed for safe execution).
GRANT cthru_readonly TO cthru;
