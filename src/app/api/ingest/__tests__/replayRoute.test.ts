/**
 * HTTP-level tests for POST /api/ingest/replay (D-34, D-37).
 *
 * These tests call the Next.js route handler directly — the same pattern used
 * in route.test.ts for the main ingest route. They prove the consent gate
 * behaves correctly at the HTTP boundary, not just at the DB-state level.
 *
 * Critical guarantees:
 *   - 401 when write key is missing or wrong (always, regardless of consent state)
 *   - 403 when replay is disabled (consent gate — D-37)
 *   - 400 when replay is enabled but userId header is missing (D-34)
 *   - 200 when replay is enabled, write key valid, userId present
 */
import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../replay/route'
import { db } from '@/lib/db'
import { enableReplay, disableReplay } from '@/lib/replay/consentGate'
import { gzipSync } from 'fflate'

const TEST_WRITE_KEY = 'test-write-key'

function makeReplayRequest(opts: {
  writeKey?: string
  userId?: string
  anonymousId?: string
  body?: Uint8Array
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  }
  if (opts.writeKey !== undefined) headers['x-write-key'] = opts.writeKey
  if (opts.userId !== undefined) headers['x-user-id'] = opts.userId
  if (opts.anonymousId !== undefined) headers['x-anonymous-id'] = opts.anonymousId
  headers['x-started-at'] = new Date().toISOString()

  const body = opts.body ?? gzipSync(new TextEncoder().encode(JSON.stringify([{ type: 2, data: {} }])))

  return new NextRequest('http://localhost:3000/api/ingest/replay', {
    method: 'POST',
    headers,
    // Buffer.from(...) yields a concretely ArrayBuffer-backed Buffer<ArrayBuffer>.
    // gzipSync()/TextEncoder return Uint8Array<ArrayBufferLike>, which TS 5.7+ no
    // longer accepts for BodyInit (it requires ArrayBufferView<ArrayBuffer> — the
    // ArrayBufferLike default also covers SharedArrayBuffer, which isn't valid here).
    body: Buffer.from(body),
  })
}

afterEach(async () => {
  await disableReplay()
})

// ---------------------------------------------------------------------------
// Auth — enforced regardless of consent state
// ---------------------------------------------------------------------------

describe('POST /api/ingest/replay — auth (always enforced)', () => {
  it('returns 401 when no write key header', async () => {
    const res = await POST(makeReplayRequest({ userId: 'user-1' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when write key is wrong', async () => {
    const res = await POST(makeReplayRequest({ writeKey: 'wrong-key', userId: 'user-1' }))
    expect(res.status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// Consent gate — D-37: 403 when replay disabled
// ---------------------------------------------------------------------------

describe('POST /api/ingest/replay — consent gate 403 (D-37)', () => {
  it('returns 403 when replay is disabled (consent gate blocks recording)', async () => {
    await disableReplay()

    const res = await POST(makeReplayRequest({
      writeKey: TEST_WRITE_KEY,
      userId: 'user-gate-test',
      anonymousId: 'anon-gate-test',
    }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('replay_disabled')
  })

  it('returns 403 for a valid request when replay has never been enabled', async () => {
    // replay_settings starts with enabled=false (no prior enable)
    const res = await POST(makeReplayRequest({
      writeKey: TEST_WRITE_KEY,
      userId: 'user-never-enabled',
      anonymousId: 'anon-never-enabled',
    }))

    expect(res.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// userId required — D-34: server-side enforcement of no-anonymous-session rule
// ---------------------------------------------------------------------------

describe('POST /api/ingest/replay — userId required (D-34)', () => {
  it('returns 400 when userId header is missing (replay enabled)', async () => {
    await enableReplay(1)

    const res = await POST(makeReplayRequest({
      writeKey: TEST_WRITE_KEY,
      anonymousId: 'anon-no-user',
      // no userId
    }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('user_id required')
  })
})

// ---------------------------------------------------------------------------
// Happy path — replay enabled, valid request
// ---------------------------------------------------------------------------

describe('POST /api/ingest/replay — accepted (D-34, D-37)', () => {
  it('returns 200 and sessionId when replay enabled, write key valid, userId present', async () => {
    await enableReplay(1)
    // Seed user so FK constraint passes
    await db.query(
      `INSERT INTO users (user_id, email) VALUES ('user-route-happy', 'happy@routetest.com') ON CONFLICT DO NOTHING`
    )

    const res = await POST(makeReplayRequest({
      writeKey: TEST_WRITE_KEY,
      userId: 'user-route-happy',
      anonymousId: 'anon-route-happy',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accepted).toBe(true)
    expect(typeof body.sessionId).toBe('string')
  })
})

// ---------------------------------------------------------------------------
// Disable: existing recordings untouched (D-37)
// ---------------------------------------------------------------------------

describe('D-37 — disable does not delete existing recordings', () => {
  it('existing session_recordings rows survive disableReplay()', async () => {
    await enableReplay(1)
    await db.query(
      `INSERT INTO users (user_id, email) VALUES ('user-disable-safe', 'safe@disabletest.com') ON CONFLICT DO NOTHING`
    )

    // Write a session while enabled
    const res = await POST(makeReplayRequest({
      writeKey: TEST_WRITE_KEY,
      userId: 'user-disable-safe',
      anonymousId: 'anon-disable-safe',
    }))
    const { sessionId } = await res.json()

    // Disable replay
    await disableReplay()

    // Session row still exists
    const { rows } = await db.query(
      `SELECT session_id FROM session_recordings WHERE session_id = $1`,
      [sessionId]
    )
    expect(rows).toHaveLength(1)
  })

  it('new POST /api/ingest/replay is rejected (403) after disable', async () => {
    await enableReplay(1)
    await disableReplay()

    const res = await POST(makeReplayRequest({
      writeKey: TEST_WRITE_KEY,
      userId: 'user-post-disable',
      anonymousId: 'anon-post-disable',
    }))

    expect(res.status).toBe(403)
  })
})
