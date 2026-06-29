/**
 * Issue 6 — Player data-loader failure states + completeness consistency (D-36).
 *
 * Critical guarantees:
 *   - not_found: unknown sessionId returns { status: 'not_found' }.
 *   - expired: session row exists, chunk_count > 0, but no chunks stored → { status: 'expired' }.
 *   - incomplete: chunks present but with a gap → { status: 'ok', complete: false }.
 *   - complete: all chunks present → { status: 'ok', complete: true }.
 *   - Shared completeness definition (D-36): for any given session, reassembleStream()
 *     and getSessionForPlayer() MUST return the same `complete` value.
 *     This is the structural proof that the two code paths cannot diverge.
 */
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'fflate'
import { db } from '../db'
import { writeSession, reassembleStream } from '../replay/storage'
import { getSessionForPlayer } from '../replay/playerLoader'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enc(content: string): Uint8Array {
  return gzipSync(new TextEncoder().encode(content))
}

async function seedUser(userId: string, email: string): Promise<void> {
  await db.query(
    `INSERT INTO users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, email]
  )
}

// ---------------------------------------------------------------------------
// 1. not_found — unknown sessionId (D-36 failure state 3)
// ---------------------------------------------------------------------------

describe('getSessionForPlayer — not_found (D-36)', () => {
  it('returns { status: "not_found" } for an unknown sessionId', async () => {
    const result = await getSessionForPlayer('00000000-0000-0000-0000-000000000000')
    expect(result.status).toBe('not_found')
  })
})

// ---------------------------------------------------------------------------
// 2. expired — session row present but all chunks deleted (D-36 failure state 3)
// ---------------------------------------------------------------------------

describe('getSessionForPlayer — expired (D-36)', () => {
  it('returns { status: "expired" } when chunks deleted but session row remains', async () => {
    await seedUser('user-player-exp', 'exp@player-test.com')

    // Write a session (creates chunks)
    const session = await writeSession({
      anonymousId: 'anon-player-exp',
      userId: 'user-player-exp',
      startedAt: new Date(),
      chunks: [enc('events')],
    })

    // Simulate retention having run: delete all chunks but leave session row
    await db.query(
      `DELETE FROM session_recording_chunks WHERE session_id = $1`,
      [session.sessionId]
    )

    const result = await getSessionForPlayer(session.sessionId)
    expect(result.status).toBe('expired')
  })
})

// ---------------------------------------------------------------------------
// 3. incomplete — ok with complete:false (D-36 failure state 1: amber banner)
// ---------------------------------------------------------------------------

describe('getSessionForPlayer — ok with complete:false (D-36)', () => {
  it('returns ok and complete:false when a chunk is missing (amber banner scenario)', async () => {
    await seedUser('user-player-inc', 'inc@player-test.com')

    // Insert session row manually with chunk_count=2, but write only one chunk
    const { rows } = await db.query<{ session_id: string }>(
      `INSERT INTO session_recordings
         (anonymous_id, user_id, started_at, expires_at, chunk_count)
       VALUES ('anon-player-inc', 'user-player-inc', NOW(), NOW() + interval '30 days', 2)
       RETURNING session_id`
    )
    const sessionId = rows[0]!.session_id

    // Insert only seq=1; seq=2 is missing → incomplete
    await db.query(
      `INSERT INTO session_recording_chunks (session_id, seq, data)
       VALUES ($1, 1, $2)`,
      [sessionId, Buffer.from(enc('snap'))]
    )

    const result = await getSessionForPlayer(sessionId)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.complete).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// 4. complete:true — all chunks present (D-36)
// ---------------------------------------------------------------------------

describe('getSessionForPlayer — ok with complete:true (D-36)', () => {
  it('returns ok and complete:true when all chunks present', async () => {
    await seedUser('user-player-full', 'full@player-test.com')

    const session = await writeSession({
      anonymousId: 'anon-player-full',
      userId: 'user-player-full',
      startedAt: new Date(),
      chunks: [enc('snap'), enc('incr')],
    })

    const result = await getSessionForPlayer(session.sessionId)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.complete).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// 5. Completeness consistency — shared definition (D-36)
//    For any given session, reassembleStream() and getSessionForPlayer()
//    MUST return the same `complete` value. This structural test proves they
//    cannot diverge.
// ---------------------------------------------------------------------------

describe('D-36 — shared completeness definition: reassembleStream and getSessionForPlayer agree', () => {
  it('both return complete:false for a session with a gap in seq numbers', async () => {
    await seedUser('user-consistency-gap', 'gap@consistency-test.com')

    const { rows } = await db.query<{ session_id: string }>(
      `INSERT INTO session_recordings
         (anonymous_id, user_id, started_at, expires_at, chunk_count)
       VALUES ('anon-gap-cons', 'user-consistency-gap', NOW(), NOW() + interval '30 days', 3)
       RETURNING session_id`
    )
    const sessionId = rows[0]!.session_id

    // Insert seq=1 and seq=3, skip seq=2
    await db.query(
      `INSERT INTO session_recording_chunks (session_id, seq, data) VALUES
         ($1, 1, $2),
         ($1, 3, $2)`,
      [sessionId, Buffer.from(enc('data'))]
    )

    const storageResult = await reassembleStream(sessionId)
    const playerResult = await getSessionForPlayer(sessionId)

    expect(storageResult).not.toBeNull()
    expect(storageResult!.complete).toBe(false)
    expect(playerResult.status).toBe('ok')
    if (playerResult.status === 'ok') {
      // THE critical assertion: same complete value from both paths
      expect(playerResult.complete).toBe(storageResult!.complete)
    }
  })

  it('both return complete:true when all chunks are present', async () => {
    await seedUser('user-consistency-full', 'full@consistency-test.com')

    const session = await writeSession({
      anonymousId: 'anon-cons-full',
      userId: 'user-consistency-full',
      startedAt: new Date(),
      chunks: [enc('snap'), enc('incr'), enc('end')],
    })

    const storageResult = await reassembleStream(session.sessionId)
    const playerResult = await getSessionForPlayer(session.sessionId)

    expect(storageResult!.complete).toBe(true)
    expect(playerResult.status).toBe('ok')
    if (playerResult.status === 'ok') {
      expect(playerResult.complete).toBe(storageResult!.complete)
    }
  })
})

// ---------------------------------------------------------------------------
// 6. Metadata correctness (D-36)
// ---------------------------------------------------------------------------

describe('getSessionForPlayer — metadata (D-36)', () => {
  it('metadata.userEmail reflects the user row email', async () => {
    await seedUser('user-player-meta', 'meta@acmecorp.com')

    const session = await writeSession({
      anonymousId: 'anon-player-meta',
      userId: 'user-player-meta',
      startedAt: new Date(),
      chunks: [enc('snap')],
    })

    const result = await getSessionForPlayer(session.sessionId)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.metadata.userEmail).toBe('meta@acmecorp.com')
      // company_domain derived at query time (not stored — D-18/D-35)
      expect(result.metadata.companyDomain).toBe('acmecorp.com')
    }
  })

  it('metadata.companyDomain is null when domain is on the blocklist (D-18/D-35)', async () => {
    const blockedDomain = 'blocked-player.com'
    await seedUser('user-player-blocked', `admin@${blockedDomain}`)
    await db.query(
      `INSERT INTO blocked_domains (domain) VALUES ($1) ON CONFLICT DO NOTHING`,
      [blockedDomain]
    )

    const session = await writeSession({
      anonymousId: 'anon-player-blocked',
      userId: 'user-player-blocked',
      startedAt: new Date(),
      chunks: [enc('snap')],
    })

    const result = await getSessionForPlayer(session.sessionId)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.metadata.companyDomain).toBeNull()
    }
  })

  it('metadata.startedAt matches writeSession input', async () => {
    await seedUser('user-player-time', 'time@startedtest.com')
    const startedAt = new Date(Date.now() - 10_000)

    const session = await writeSession({
      anonymousId: 'anon-player-time',
      userId: 'user-player-time',
      startedAt,
      chunks: [enc('snap')],
    })

    const result = await getSessionForPlayer(session.sessionId)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.metadata.startedAt.getTime()).toBeCloseTo(startedAt.getTime(), -3)
    }
  })
})
