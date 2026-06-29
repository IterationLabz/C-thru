// Player data-loader (D-36).
//
// getSessionForPlayer() is the SINGLE function the player page calls.
// It owns the fetch → decompress → reassemble → integrity-check pipeline.
// The player component never queries the DB or touches the storage module directly.
//
// Returns one of three shapes (D-36):
//   { status: 'ok', stream, metadata, complete }
//   { status: 'expired' }   — session row gone or all chunks deleted (retention ran)
//   { status: 'not_found' } — session_id unknown
//
// "complete" uses the SAME shared definition as reassembleStream (D-36):
//   seq=1 present AND chunks 1..chunk_count with no gap.
// This is enforced by delegating directly to reassembleStream — both the
// player and the storage round-trip test call the same underlying function,
// so the definition cannot diverge.

import { db } from '../db'
import { reassembleStream, type StoredSession } from './storage'

export type PlayerResult =
  | { status: 'ok'; stream: Uint8Array; metadata: PlayerMetadata; complete: boolean }
  | { status: 'expired' }
  | { status: 'not_found' }

export interface PlayerMetadata {
  sessionId: string
  userId: string
  userEmail: string | null
  companyDomain: string | null   // derived at query time (D-18/D-35), never stored
  durationMs: number | null
  startedAt: Date
}

export async function getSessionForPlayer(sessionId: string): Promise<PlayerResult> {
  // Check session row exists (regardless of whether chunks are present)
  const { rows: sessionRows } = await db.query<{
    session_id: string
    user_id: string
    started_at: Date
    ended_at: Date | null
    expires_at: Date
    chunk_count: number
  }>(
    `SELECT session_id, user_id, started_at, ended_at, expires_at, chunk_count
     FROM session_recordings WHERE session_id = $1`,
    [sessionId]
  )

  if (sessionRows.length === 0) {
    return { status: 'not_found' }
  }

  const session = sessionRows[0]!

  // If session row exists but has expired (retention ran and deleted chunks),
  // treat as 'expired' so the player shows a clear "deleted per retention policy"
  // message rather than an empty/broken player (D-36 failure state 3).
  const { rows: chunkRows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM session_recording_chunks WHERE session_id = $1`,
    [sessionId]
  )
  const chunkCount = parseInt(chunkRows[0]?.count ?? '0', 10)

  if (chunkCount === 0 && session.chunk_count > 0) {
    return { status: 'expired' }
  }

  // Derive company_domain at query time (D-18/D-35).
  const { rows: userRows } = await db.query<{
    email: string | null
    company_domain: string | null
  }>(
    `SELECT u.email,
            CASE WHEN bd.domain IS NULL THEN split_part(u.email, '@', 2)
                 ELSE NULL
            END AS company_domain
     FROM users u
     LEFT JOIN blocked_domains bd ON bd.domain = split_part(u.email, '@', 2)
     WHERE u.user_id = $1`,
    [session.user_id]
  )

  const userEmail = userRows[0]?.email ?? null
  const companyDomain = userRows[0]?.company_domain ?? null
  const durationMs =
    session.ended_at
      ? session.ended_at.getTime() - session.started_at.getTime()
      : null

  // Pre-playback integrity check: reassemble uses the shared completeness definition.
  // This runs before the player starts so incompleteness is known up front (D-36).
  const reassembled = await reassembleStream(sessionId)
  if (!reassembled) {
    return { status: 'expired' }
  }

  return {
    status: 'ok',
    stream: reassembled.stream,
    complete: reassembled.complete,
    metadata: {
      sessionId: session.session_id,
      userId: session.user_id,
      userEmail,
      companyDomain,
      durationMs,
      startedAt: session.started_at,
    },
  }
}
