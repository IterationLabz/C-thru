import { describe, it, expect } from 'vitest'
import { pinQuery, listPinnedQueries, unpinQuery } from '../pinnedQueries'
import { validateAndRun } from '../sqlGuard'

describe('pinnedQueries', () => {
  it('saves a query and retrieves it', async () => {
    await pinQuery('how many signups?', 'SELECT COUNT(*) FROM signups_v LIMIT 500')

    const pins = await listPinnedQueries()
    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({
      question: 'how many signups?',
      sql: 'SELECT COUNT(*) FROM signups_v LIMIT 500',
    })
    expect(pins[0]!.id).toBeTypeOf('number')
  })

  it('returns queries ordered oldest-first', async () => {
    await pinQuery('first', 'SELECT COUNT(*) FROM signups_v LIMIT 500')
    await pinQuery('second', 'SELECT COUNT(*) FROM active_users_v LIMIT 500')

    const pins = await listPinnedQueries()
    expect(pins[0]!.question).toBe('first')
    expect(pins[1]!.question).toBe('second')
  })

  it('removes a pinned query', async () => {
    const pin = await pinQuery('to delete', 'SELECT COUNT(*) FROM signups_v LIMIT 500')
    await unpinQuery(pin.id)
    const pins = await listPinnedQueries()
    expect(pins).toHaveLength(0)
  })

  it('returns empty list when no queries are pinned', async () => {
    const pins = await listPinnedQueries()
    expect(pins).toHaveLength(0)
  })

  it('re-runs pinned SQL through validateAndRun to produce a fresh result', async () => {
    const { processEvent } = await import('../processEvent')
    await processEvent({
      name: 'pageview',
      source: 'auto',
      anonymousId: 'anon-pin-1',
      occurredAt: new Date().toISOString(),
      userId: 'user-pin-1',
      email: 'pin@acme.com',
    })

    const sql = 'SELECT COUNT(*) AS total FROM signups_v LIMIT 500'
    await pinQuery('how many signups?', sql)

    const [pin] = await listPinnedQueries()
    const result = await validateAndRun(pin!.sql)

    expect(result.rows).toHaveLength(1)
    expect(Number(result.rows[0]!['total'])).toBe(1)
  })

  it('rejects execution if stored SQL references a non-allowed table', async () => {
    // Directly insert a tampered query (bypassing pinQuery which takes already-validated SQL)
    const { db } = await import('../db')
    await db.query(
      "INSERT INTO pinned_queries (question, sql) VALUES ('tampered', 'SELECT * FROM users')"
    )
    const [pin] = await listPinnedQueries()
    await expect(validateAndRun(pin!.sql)).rejects.toThrow('not in the allowed query surface')
  })
})
