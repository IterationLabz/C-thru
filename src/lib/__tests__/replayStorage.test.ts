/**
 * Issue 3 — Chunked Postgres storage + reassembly (D-33, Stories 25–26, 28–30).
 *
 * Tests the writeSession / reassembleStream deep-module pair.
 * Critical guarantees:
 *   - Round-trip: compress → chunk → store → reassemble → byte-identical stream.
 *   - Sequence gap → complete:false (shared completeness definition with player).
 *   - company_domain NOT stored on session_recordings (D-18/D-35 consistency).
 *   - expires_at set at write time from replay_settings.retention_days.
 */
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'fflate'
import { db } from '../db'
import { writeSession, reassembleStream } from '../replay/storage'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStream(content: string): Uint8Array {
  return new TextEncoder().encode(content)
}

function compressChunk(data: Uint8Array): Uint8Array {
  return gzipSync(data)
}

// Split a Uint8Array into N equal-ish chunks
function splitChunks(data: Uint8Array, n: number): Uint8Array[] {
  const chunkSize = Math.ceil(data.length / n)
  const chunks: Uint8Array[] = []
  for (let i = 0; i < n; i++) {
    chunks.push(data.slice(i * chunkSize, (i + 1) * chunkSize))
  }
  return chunks
}

// ---------------------------------------------------------------------------
// 1. Round-trip: store → reassemble → byte-identical (D-33, Stories 25–26)
// ---------------------------------------------------------------------------

describe('storage round-trip — compress → store → reassemble → identical (D-33)', () => {
  it('single-chunk round-trip produces byte-identical stream', async () => {
    const original = makeStream(JSON.stringify([{ type: 2, data: { node: {} } }]))
    const compressed = compressChunk(original)

    const session = await writeSession({
      anonymousId: 'anon-rt-1',
      userId: 'user-rt-1',
      startedAt: new Date(),
      chunks: [compressed],
    })

    const result = await reassembleStream(session.sessionId)
    expect(result).not.toBeNull()
    expect(result!.stream).toEqual(original)
    expect(result!.complete).toBe(true)
  })

  it('three-chunk round-trip produces byte-identical concatenated stream', async () => {
    const originalParts = [
      makeStream(JSON.stringify([{ type: 2, seq: 1 }])),
      makeStream(JSON.stringify([{ type: 3, seq: 2 }])),
      makeStream(JSON.stringify([{ type: 3, seq: 3 }])),
    ]
    const expected = new Uint8Array(
      originalParts.reduce((sum, p) => sum + p.length, 0)
    )
    let off = 0
    for (const p of originalParts) { expected.set(p, off); off += p.length }

    const chunks = originalParts.map(compressChunk)

    const session = await writeSession({
      anonymousId: 'anon-rt-2',
      userId: 'user-rt-2',
      startedAt: new Date(),
      chunks,
    })

    const result = await reassembleStream(session.sessionId)
    expect(result!.stream).toEqual(expected)
    expect(result!.complete).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. Sequence numbers — deterministic ordering (D-33, Story 28)
// ---------------------------------------------------------------------------

describe('storage — sequence numbers for deterministic ordering (D-33)', () => {
  it('chunks are stored with seq starting at 1', async () => {
    const chunks = [compressChunk(makeStream('a')), compressChunk(makeStream('b'))]
    const session = await writeSession({
      anonymousId: 'anon-seq-1',
      userId: 'user-seq-1',
      startedAt: new Date(),
      chunks,
    })

    const { rows } = await db.query<{ seq: number }>(
      `SELECT seq FROM session_recording_chunks WHERE session_id = $1 ORDER BY seq`,
      [session.sessionId]
    )
    expect(rows.map(r => r.seq)).toEqual([1, 2])
  })
})

// ---------------------------------------------------------------------------
// 3. chunk_count integrity (D-33, Story 29)
// ---------------------------------------------------------------------------

describe('storage — chunk_count stored on session row (D-33, Story 29)', () => {
  it('session row reflects the exact number of chunks written', async () => {
    const chunks = [
      compressChunk(makeStream('part1')),
      compressChunk(makeStream('part2')),
      compressChunk(makeStream('part3')),
    ]
    const session = await writeSession({
      anonymousId: 'anon-cc-1',
      userId: 'user-cc-1',
      startedAt: new Date(),
      chunks,
    })

    expect(session.chunkCount).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// 4. Completeness definition — shared with player (D-36, Stories 52, 55)
// ---------------------------------------------------------------------------

describe('reassembleStream — shared completeness definition (D-36)', () => {
  it('complete:false when a middle chunk is missing', async () => {
    // Write session with chunk_count=3 but only insert chunks 1 and 3 (skip seq=2)
    const { rows: insertedSession } = await db.query<{ session_id: string }>(
      `INSERT INTO session_recordings
         (anonymous_id, user_id, started_at, expires_at, chunk_count)
       VALUES ('anon-gap', 'user-gap', NOW(), NOW() + interval '30 days', 3)
       RETURNING session_id`
    )
    const sessionId = insertedSession[0]!.session_id

    // Insert only seq=1 and seq=3 (gap at seq=2)
    await db.query(
      `INSERT INTO session_recording_chunks (session_id, seq, data) VALUES
         ($1, 1, $2),
         ($1, 3, $2)`,
      [sessionId, Buffer.from(compressChunk(makeStream('data')))]
    )

    const result = await reassembleStream(sessionId)
    expect(result).not.toBeNull()
    expect(result!.complete).toBe(false)
  })

  it('complete:false when last chunk is missing', async () => {
    const chunks = [compressChunk(makeStream('a')), compressChunk(makeStream('b'))]
    const session = await writeSession({
      anonymousId: 'anon-missing-last',
      userId: 'user-missing-last',
      startedAt: new Date(),
      chunks,
    })

    // Delete the last chunk to simulate an incomplete write
    await db.query(
      `DELETE FROM session_recording_chunks WHERE session_id = $1 AND seq = 2`,
      [session.sessionId]
    )

    const result = await reassembleStream(session.sessionId)
    expect(result!.complete).toBe(false)
  })

  it('complete:true when all chunks present in sequence', async () => {
    const chunks = [
      compressChunk(makeStream('snap')),
      compressChunk(makeStream('incr')),
    ]
    const session = await writeSession({
      anonymousId: 'anon-full',
      userId: 'user-full',
      startedAt: new Date(),
      chunks,
    })

    const result = await reassembleStream(session.sessionId)
    expect(result!.complete).toBe(true)
  })

  it('returns null for an unknown sessionId', async () => {
    const result = await reassembleStream('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 5. company_domain NOT stored — D-18/D-35 consistency
// ---------------------------------------------------------------------------

describe('session_recordings schema — no company_domain column (D-35)', () => {
  it('session_recordings table has no company_domain column', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'session_recordings'`
    )
    const columns = rows.map(r => r.column_name)
    expect(columns).not.toContain('company_domain')
  })

  it('session row contains anonymous_id, user_id, expires_at, chunk_count', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'session_recordings'`
    )
    const columns = rows.map(r => r.column_name)
    expect(columns).toContain('anonymous_id')
    expect(columns).toContain('user_id')
    expect(columns).toContain('expires_at')
    expect(columns).toContain('chunk_count')
  })
})

// ---------------------------------------------------------------------------
// 6. expires_at set at write time from retention_days (D-31, D-33)
// ---------------------------------------------------------------------------

describe('writeSession — expires_at set from retention_days (D-31)', () => {
  it('expires_at is in the future (default 30-day window)', async () => {
    const session = await writeSession({
      anonymousId: 'anon-exp',
      userId: 'user-exp',
      startedAt: new Date(),
      chunks: [compressChunk(makeStream('data'))],
    })

    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('expires_at is approximately retention_days from now', async () => {
    const before = Date.now()
    const session = await writeSession({
      anonymousId: 'anon-exp2',
      userId: 'user-exp2',
      startedAt: new Date(),
      chunks: [compressChunk(makeStream('data'))],
    })
    const after = Date.now()

    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    const expiresMs = session.expiresAt.getTime()
    // Allow ±2 minutes tolerance for test execution time
    expect(expiresMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 120_000)
    expect(expiresMs).toBeLessThanOrEqual(after + thirtyDaysMs + 120_000)
  })
})
