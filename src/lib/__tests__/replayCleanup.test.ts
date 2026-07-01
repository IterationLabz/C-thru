/**
 * Issue 4 — Retention cleanup background job (D-31, Stories 31–37).
 *
 * Critical guarantees:
 *   - By-session deletion: all chunks for an expired session are deleted together
 *     (no orphaned chunks left behind).
 *   - Idempotent: running cleanup twice produces the same result.
 *   - Logged: returns { sessionsDeleted, bytesFreed, ranAt }.
 *   - Non-expired sessions are untouched.
 *   - Retroactive: session with expires_at already in the past is deleted at the
 *     next run, regardless of when expires_at was set.
 */
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'fflate'
import { db } from '../db'
import { writeSession } from '../replay/storage'
import { runRetentionCleanup } from '../replay/cleanup'

function compressedChunk(content: string): Uint8Array {
  return gzipSync(new TextEncoder().encode(content))
}

async function insertExpiredSession(chunkCount = 2): Promise<string> {
  const chunks = Array.from({ length: chunkCount }, (_, i) =>
    compressedChunk(`event-data-${i}`)
  )
  const session = await writeSession({
    anonymousId: 'anon-expired',
    userId: 'user-expired',
    startedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    chunks,
  })
  // Manually set expires_at to the past
  await db.query(
    `UPDATE session_recordings SET expires_at = NOW() - interval '1 day'
     WHERE session_id = $1`,
    [session.sessionId]
  )
  return session.sessionId
}

async function insertCurrentSession(): Promise<string> {
  const session = await writeSession({
    anonymousId: 'anon-current',
    userId: 'user-current',
    startedAt: new Date(),
    chunks: [compressedChunk('current-data')],
  })
  return session.sessionId
}

async function chunkCountFor(sessionId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM session_recording_chunks WHERE session_id = $1`,
    [sessionId]
  )
  return parseInt(rows[0]?.count ?? '0', 10)
}

async function sessionExists(sessionId: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM session_recordings WHERE session_id = $1`,
    [sessionId]
  )
  return rows.length > 0
}

// ---------------------------------------------------------------------------
// By-session deletion — no orphaned chunks (Story 33)
// ---------------------------------------------------------------------------

describe('D-31 — by-session deletion: no orphaned chunks (Story 33)', () => {
  it('deletes all chunks belonging to an expired session', async () => {
    const expiredId = await insertExpiredSession(3)

    await runRetentionCleanup()

    expect(await chunkCountFor(expiredId)).toBe(0)
  })

  it('deletes the session row itself', async () => {
    const expiredId = await insertExpiredSession()

    await runRetentionCleanup()

    expect(await sessionExists(expiredId)).toBe(false)
  })

  it('leaves non-expired sessions and their chunks intact', async () => {
    const expiredId = await insertExpiredSession()
    const currentId = await insertCurrentSession()

    await runRetentionCleanup()

    expect(await sessionExists(expiredId)).toBe(false)
    expect(await sessionExists(currentId)).toBe(true)
    expect(await chunkCountFor(currentId)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Idempotent (Story 34)
// ---------------------------------------------------------------------------

describe('D-31 — idempotent: running twice is safe (Story 34)', () => {
  it('second run after cleanup reports 0 sessions deleted', async () => {
    await insertExpiredSession()

    const first = await runRetentionCleanup()
    const second = await runRetentionCleanup()

    expect(first.sessionsDeleted).toBe(1)
    expect(second.sessionsDeleted).toBe(0)
  })

  it('no orphaned chunks after double run', async () => {
    const expiredId = await insertExpiredSession(2)

    await runRetentionCleanup()
    await runRetentionCleanup()

    expect(await chunkCountFor(expiredId)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Logged: returns { sessionsDeleted, bytesFreed, ranAt } (Story 35)
// ---------------------------------------------------------------------------

describe('D-31 — logged: returns count + bytes freed (Story 35)', () => {
  it('returns sessionsDeleted count', async () => {
    await insertExpiredSession()
    await insertExpiredSession()

    const result = await runRetentionCleanup()
    expect(result.sessionsDeleted).toBe(2)
  })

  it('returns bytesFreed > 0 when chunks existed', async () => {
    await insertExpiredSession(3)

    const result = await runRetentionCleanup()
    expect(result.bytesFreed).toBeGreaterThan(0)
  })

  it('returns ranAt as a Date', async () => {
    const result = await runRetentionCleanup()
    expect(result.ranAt).toBeInstanceOf(Date)
  })

  it('returns sessionsDeleted=0 when nothing is expired', async () => {
    await insertCurrentSession()

    const result = await runRetentionCleanup()
    expect(result.sessionsDeleted).toBe(0)
    expect(result.bytesFreed).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Retroactive: expires_at in the past → deleted on next run (Story 36)
// ---------------------------------------------------------------------------

describe('D-31 — retroactive: past expires_at deleted on next run (Story 36)', () => {
  it('session with expires_at in the past is deleted regardless of creation time', async () => {
    // Simulate a scenario where the retention window was shortened after capture:
    // the session was created with a 60-day window but we're now enforcing 30 days.
    const chunks = [compressedChunk('old-data')]
    const session = await writeSession({
      anonymousId: 'anon-retro',
      userId: 'user-retro',
      startedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      chunks,
    })
    // Set expires_at to yesterday (simulates retroactive window shortening)
    await db.query(
      `UPDATE session_recordings SET expires_at = NOW() - interval '1 day'
       WHERE session_id = $1`,
      [session.sessionId]
    )

    await runRetentionCleanup()

    expect(await sessionExists(session.sessionId)).toBe(false)
  })
})
