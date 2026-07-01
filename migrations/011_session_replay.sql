-- Session Replay storage (D-33, D-35, D-37).
-- Three tables: session_recordings (one row per session), session_recording_chunks
-- (one row per compressed chunk, ordered by seq), replay_settings (singleton config).

-- session_recordings: metadata + integrity check value for each recorded session.
-- No company_domain column — derived at query time (D-18/D-35).
CREATE TABLE IF NOT EXISTS session_recordings (
  session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id  TEXT NOT NULL,
  user_id       TEXT NOT NULL,                    -- never null: anonymous sessions discarded client-side (D-34)
  started_at    TIMESTAMPTZ NOT NULL,
  ended_at      TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL,             -- set at write time from retention_days; used by cleanup job (D-31)
  chunk_count   INTEGER NOT NULL DEFAULT 0,       -- expected chunk count; used for completeness check (D-36)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_recordings_user_id     ON session_recordings (user_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_anonymous_id ON session_recordings (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_session_recordings_expires_at  ON session_recordings (expires_at);

-- session_recording_chunks: gzip-compressed BYTEA chunks, ordered by sequence number.
-- Sequence numbers (not timestamps) ensure deterministic reassembly (D-33).
CREATE TABLE IF NOT EXISTS session_recording_chunks (
  session_id  UUID NOT NULL REFERENCES session_recordings (session_id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,         -- 1-based; seq=1 is the snapshot chunk
  data        BYTEA NOT NULL,           -- gzip-compressed rrweb event stream slice
  PRIMARY KEY (session_id, seq)
);

-- replay_settings: singleton config row (always id=1).
-- enabled=false by default (D-37: off-by-default, first off-by-default feature).
-- acknowledged_at / acknowledged_clause_version record the founder's first-enable
-- disclosure acknowledgment as an audit record (D-37).
CREATE TABLE IF NOT EXISTS replay_settings (
  id                           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled                      BOOLEAN NOT NULL DEFAULT false,
  retention_days               INTEGER NOT NULL DEFAULT 30,
  sample_rate                  NUMERIC(4,3) NOT NULL DEFAULT 1.0 CHECK (sample_rate BETWEEN 0 AND 1),
  acknowledged_at              TIMESTAMPTZ,
  acknowledged_clause_version  INTEGER,
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO replay_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
