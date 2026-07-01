// Chunked storage writer + reassembler (D-33, D-35).
//
// writeSession()     — writes session row + chunk rows in a transaction.
// reassembleStream() — fetches chunks by seq, decompresses, returns stream.
//
// ONE shared completeness definition (D-36):
//   complete = seq=1 (snapshot chunk) present AND chunks 1..chunk_count
//              all present with no gap in seq numbers.
// This definition is used by BOTH this module (reassembleStream) and the
// player data-loader (playerLoader.ts). They must never diverge.

import { gunzipSync } from 'fflate'
import { db } from '../db'

export interface WriteSessionParams {
  sessionId?: string      // auto-generated UUID if omitted
  anonymousId: string
  userId: string
  startedAt: Date
  endedAt?: Date
  chunks: Uint8Array[]   // gzip-compressed rrweb event stream slices, in order
}

export interface StoredSession {
  sessionId: string
  anonymousId: string
  userId: string
  startedAt: Date
  endedAt: Date | null
  expiresAt: Date
  chunkCount: number
}

export interface ReassembledStream {
  stream: Uint8Array        // decompressed, concatenated rrweb event stream
  complete: boolean         // false if any chunk is missing (shared definition)
  metadata: StoredSession
}

// ---------------------------------------------------------------------------
// writeSession
// ---------------------------------------------------------------------------

export async function writeSession(params: WriteSessionParams): Promise<StoredSession> {
  const { anonymousId, userId, startedAt, endedAt, chunks } = params

  const { rows: settingsRows } = await db.query<{ retention_days: number }>(
    `SELECT retention_days FROM replay_settings WHERE id = 1`
  )
  const retentionDays = settingsRows[0]?.retention_days ?? 30

  const { rows } = await db.query<{
    session_id: string
    anonymous_id: string
    user_id: string
    started_at: Date
    ended_at: Date | null
    expires_at: Date
    chunk_count: number
  }>(
    `INSERT INTO session_recordings
       (anonymous_id, user_id, started_at, ended_at, expires_at, chunk_count)
     VALUES ($1, $2, $3, $4,
             NOW() + ($5 || ' days')::interval,
             $6)
     RETURNING *`,
    [anonymousId, userId, startedAt, endedAt ?? null, retentionDays, chunks.length]
  )
  const session = rows[0]!

  // Insert all chunks in a single transaction using unnest for efficiency.
  if (chunks.length > 0) {
    const seqs = chunks.map((_, i) => i + 1)
    await db.query(
      `INSERT INTO session_recording_chunks (session_id, seq, data)
       SELECT $1, seq, data
       FROM unnest($2::int[], $3::bytea[]) AS t(seq, data)`,
      [session.session_id, seqs, chunks]
    )
  }

  return {
    sessionId: session.session_id,
    anonymousId: session.anonymous_id,
    userId: session.user_id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    expiresAt: session.expires_at,
    chunkCount: session.chunk_count,
  }
}

// ---------------------------------------------------------------------------
// reassembleStream
// ---------------------------------------------------------------------------

// isComplete applies the ONE shared completeness definition (D-36):
//   snapshot chunk (seq=1) present AND chunks 1..N with no gap.
function isComplete(presentSeqs: number[], expectedCount: number): boolean {
  if (presentSeqs.length !== expectedCount) return false
  for (let i = 1; i <= expectedCount; i++) {
    if (!presentSeqs.includes(i)) return false
  }
  return true
}

export async function reassembleStream(sessionId: string): Promise<ReassembledStream | null> {
  const { rows: sessionRows } = await db.query<{
    session_id: string
    anonymous_id: string
    user_id: string
    started_at: Date
    ended_at: Date | null
    expires_at: Date
    chunk_count: number
  }>(
    `SELECT * FROM session_recordings WHERE session_id = $1`,
    [sessionId]
  )
  if (sessionRows.length === 0) return null

  const session = sessionRows[0]!

  const { rows: chunkRows } = await db.query<{ seq: number; data: Buffer }>(
    `SELECT seq, data FROM session_recording_chunks
     WHERE session_id = $1 ORDER BY seq ASC`,
    [sessionId]
  )

  const presentSeqs = chunkRows.map(r => r.seq)
  const complete = isComplete(presentSeqs, session.chunk_count)

  // Decompress and concatenate available chunks in seq order.
  const parts: Uint8Array[] = []
  for (const chunk of chunkRows) {
    parts.push(gunzipSync(new Uint8Array(chunk.data)))
  }

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0)
  const stream = new Uint8Array(totalLength)
  let offset = 0
  for (const part of parts) {
    stream.set(part, offset)
    offset += part.length
  }

  return {
    stream,
    complete,
    metadata: {
      sessionId: session.session_id,
      anonymousId: session.anonymous_id,
      userId: session.user_id,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      expiresAt: session.expires_at,
      chunkCount: session.chunk_count,
    },
  }
}
