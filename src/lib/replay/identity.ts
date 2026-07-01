// Identity linkage for session replay (D-35).
//
// session_recordings stamps anonymous_id + user_id at flush (immutable).
// company_domain is NEVER stored — derived at query time via
//   user_id → users.email → domain → blocked_domains join
// This is the same D-18 consistency guarantee used by company_activity_v.
//
// Surface functions:
//   getJourneyRecordings()  — inline markers for the journey timeline
//   getAccountRecordings()  — count + most-recent session for the account page

import { db } from '../db'

export interface JourneyRecordingMarker {
  sessionId: string
  startedAt: string   // placed at session start (before identification seam — D-35)
  complete: boolean
}

export interface AccountRecordingSummary {
  count: number
  mostRecentSessionId: string | null
}

// getJourneyRecordings — recording markers for a user's journey timeline.
// Returns one marker per session, ordered by started_at ascending.
// Placed at session.started_at (NOT at identify time) — the pre-identify
// portion of the recording is the most valuable part (D-34/D-35).
export async function getJourneyRecordings(
  userId: string
): Promise<JourneyRecordingMarker[]> {
  const { rows } = await db.query<{
    session_id: string
    started_at: string
    chunk_count: number
    actual_chunks: string
  }>(
    `SELECT
       sr.session_id,
       sr.started_at::text,
       sr.chunk_count,
       COUNT(src.seq)::text AS actual_chunks
     FROM session_recordings sr
     LEFT JOIN session_recording_chunks src ON src.session_id = sr.session_id
     WHERE sr.user_id = $1
       AND sr.expires_at > NOW()
     GROUP BY sr.session_id, sr.started_at, sr.chunk_count
     ORDER BY sr.started_at ASC`,
    [userId]
  )

  return rows.map(r => ({
    sessionId: r.session_id,
    startedAt: r.started_at,
    // Shared completeness definition (D-36): all chunks 1..chunk_count present.
    complete: parseInt(r.actual_chunks, 10) === r.chunk_count && r.chunk_count > 0,
  }))
}

// getAccountRecordings — recording count + most-recent session for an account page.
// company_domain is derived at query time (D-18 consistency: blocklist changes
// take effect immediately without requiring a scan of session_recordings).
export async function getAccountRecordings(
  domain: string
): Promise<AccountRecordingSummary> {
  const { rows } = await db.query<{
    count: string
    most_recent_session_id: string | null
  }>(
    `SELECT
       COUNT(sr.session_id)::text AS count,
       (
         SELECT sr2.session_id::text
         FROM session_recordings sr2
         JOIN users u2 ON u2.user_id = sr2.user_id
         LEFT JOIN blocked_domains bd2 ON bd2.domain = split_part(u2.email, '@', 2)
         WHERE bd2.domain IS NULL
           AND split_part(u2.email, '@', 2) = $1
           AND sr2.expires_at > NOW()
         ORDER BY sr2.started_at DESC
         LIMIT 1
       ) AS most_recent_session_id
     FROM session_recordings sr
     JOIN users u ON u.user_id = sr.user_id
     LEFT JOIN blocked_domains bd ON bd.domain = split_part(u.email, '@', 2)
     WHERE bd.domain IS NULL
       AND split_part(u.email, '@', 2) = $1
       AND sr.expires_at > NOW()`,
    [domain]
  )

  return {
    count: parseInt(rows[0]?.count ?? '0', 10),
    mostRecentSessionId: rows[0]?.most_recent_session_id ?? null,
  }
}
