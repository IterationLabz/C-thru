/**
 * Issue 5 — Identity linkage + journey marker + account recording count (D-35, Stories 38–45).
 *
 * Critical guarantees:
 *   - company_domain NOT stored; derived at query time (D-18 consistency).
 *   - Blocked domain: adding domain to blocklist drops recordings from account
 *     view without deleting them.
 *   - Journey markers placed at session.started_at (before identification seam).
 *   - Alias model reused unchanged; no parallel identity system.
 */
import { describe, it, expect } from 'vitest'
import { gzipSync } from 'fflate'
import { db } from '../db'
import { writeSession } from '../replay/storage'
import { getJourneyRecordings, getAccountRecordings } from '../replay/identity'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunk(content: string): Uint8Array {
  return gzipSync(new TextEncoder().encode(content))
}

async function seedUser(userId: string, email: string): Promise<void> {
  await db.query(
    `INSERT INTO users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, email]
  )
}

async function seedAlias(anonymousId: string, userId: string): Promise<void> {
  await db.query(
    `INSERT INTO aliases (anonymous_id, user_id, first_identified_at)
     VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
    [anonymousId, userId]
  )
}

// ---------------------------------------------------------------------------
// 1. company_domain NOT stored (D-18/D-35)
// ---------------------------------------------------------------------------

describe('D-35 — company_domain not stored on session_recordings', () => {
  it('session_recordings has no company_domain column', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'session_recordings'`
    )
    expect(rows.map(r => r.column_name)).not.toContain('company_domain')
  })
})

// ---------------------------------------------------------------------------
// 2. Blocklist consistency (D-18 / D-35): adding domain to blocklist
//    removes recordings from account view without deleting them.
// ---------------------------------------------------------------------------

describe('D-35 — blocklist consistency: company_domain derived at query time', () => {
  it('account recording count drops to 0 when domain is blocked (no deletion)', async () => {
    const userId = 'user-blocklist-1'
    const email = 'priya@blockme-corp.com'
    await seedUser(userId, email)

    const session = await writeSession({
      anonymousId: 'anon-bl-1',
      userId,
      startedAt: new Date(),
      chunks: [chunk('data')],
    })

    // Before blocking: count should be 1
    const before = await getAccountRecordings('blockme-corp.com')
    expect(before.count).toBe(1)

    // Add domain to blocklist
    await db.query(
      `INSERT INTO blocked_domains (domain) VALUES ('blockme-corp.com') ON CONFLICT DO NOTHING`
    )

    // After blocking: recordings are excluded from the account view (derived at query time)
    const after = await getAccountRecordings('blockme-corp.com')
    expect(after.count).toBe(0)

    // Recording itself is still in the DB (not deleted)
    const { rows } = await db.query(
      `SELECT 1 FROM session_recordings WHERE session_id = $1`,
      [session.sessionId]
    )
    expect(rows).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. Journey recording markers (Stories 41–43)
// ---------------------------------------------------------------------------

describe('D-35 — journey recording markers (Stories 41–43)', () => {
  it('returns one marker per session for the user, ordered by started_at', async () => {
    const userId = 'user-journey-1'
    await seedUser(userId, 'user@journey-co.com')
    await seedAlias('anon-j1', userId)

    const t1 = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2h ago
    const t2 = new Date(Date.now() - 1 * 60 * 60 * 1000) // 1h ago

    await writeSession({ anonymousId: 'anon-j1', userId, startedAt: t1, chunks: [chunk('snap1')] })
    await writeSession({ anonymousId: 'anon-j1', userId, startedAt: t2, chunks: [chunk('snap2')] })

    const markers = await getJourneyRecordings(userId)
    expect(markers).toHaveLength(2)
    // ordered ascending (earliest first — matches journey timeline order)
    expect(new Date(markers[0]!.startedAt).getTime()).toBeLessThan(
      new Date(markers[1]!.startedAt).getTime()
    )
  })

  it('each marker has sessionId and startedAt', async () => {
    const userId = 'user-journey-2'
    await seedUser(userId, 'u2@journey-co.com')

    await writeSession({ anonymousId: 'anon-j2', userId, startedAt: new Date(), chunks: [chunk('snap')] })

    const markers = await getJourneyRecordings(userId)
    expect(markers[0]).toMatchObject({
      sessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      startedAt: expect.any(String),
      complete: expect.any(Boolean),
    })
  })

  it('expired sessions do not appear as journey markers', async () => {
    const userId = 'user-journey-expired'
    await seedUser(userId, 'exp@journey-co.com')

    const session = await writeSession({
      anonymousId: 'anon-jexp',
      userId,
      startedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      chunks: [chunk('old')],
    })
    await db.query(
      `UPDATE session_recordings SET expires_at = NOW() - interval '1 day' WHERE session_id = $1`,
      [session.sessionId]
    )

    const markers = await getJourneyRecordings(userId)
    expect(markers.find(m => m.sessionId === session.sessionId)).toBeUndefined()
  })

  it('returns empty array when user has no recordings', async () => {
    const userId = 'user-journey-norec'
    await seedUser(userId, 'norec@journey-co.com')
    expect(await getJourneyRecordings(userId)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 4. Account recording count (Stories 44–45)
// ---------------------------------------------------------------------------

describe('D-35 — account recording count (Stories 44–45)', () => {
  it('returns count of recordings for a domain', async () => {
    const domain = 'acme-replay.com'
    await seedUser('user-acme-1', `alice@${domain}`)
    await seedUser('user-acme-2', `bob@${domain}`)

    await writeSession({ anonymousId: 'anon-acme-1', userId: 'user-acme-1', startedAt: new Date(), chunks: [chunk('a')] })
    await writeSession({ anonymousId: 'anon-acme-2', userId: 'user-acme-2', startedAt: new Date(), chunks: [chunk('b')] })

    const summary = await getAccountRecordings(domain)
    expect(summary.count).toBe(2)
  })

  it('returns mostRecentSessionId pointing to the latest session', async () => {
    const domain = 'recent-test.com'
    await seedUser('user-recent-1', `x@${domain}`)

    const old = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const recent = new Date(Date.now() - 1 * 60 * 60 * 1000)

    await writeSession({ anonymousId: 'anon-r1', userId: 'user-recent-1', startedAt: old, chunks: [chunk('old')] })
    const newest = await writeSession({ anonymousId: 'anon-r2', userId: 'user-recent-1', startedAt: recent, chunks: [chunk('new')] })

    const summary = await getAccountRecordings(domain)
    expect(summary.mostRecentSessionId).toBe(newest.sessionId)
  })

  it('returns count=0 and mostRecentSessionId=null for a domain with no recordings', async () => {
    const summary = await getAccountRecordings('no-recordings-here.com')
    expect(summary.count).toBe(0)
    expect(summary.mostRecentSessionId).toBeNull()
  })
})
