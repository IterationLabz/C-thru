import { describe, it, expect } from 'vitest'
import { validateAndRun } from '../sqlGuard'
import { processEvent } from '../processEvent'

describe('validateAndRun', () => {
  it('returns rows for a valid SELECT against an allowed view', async () => {
    await processEvent({
      name: 'pageview',
      source: 'auto',
      anonymousId: 'anon-var-1',
      occurredAt: new Date().toISOString(),
      userId: 'user-var-1',
      email: 'alice@acme.com',
    })

    const result = await validateAndRun('SELECT user_id FROM signups_v WHERE user_id = \'user-var-1\'')
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ user_id: 'user-var-1' })
    expect(result.rowCount).toBe(1)
  })

  it('throws for non-SELECT SQL without touching the DB', async () => {
    await expect(validateAndRun("INSERT INTO signups_v VALUES ('x')"))
      .rejects.toThrow('Only SELECT is allowed')
  })

  it('injects LIMIT 500 when the query has no LIMIT', async () => {
    await processEvent({
      name: 'pageview',
      source: 'auto',
      anonymousId: 'anon-var-2',
      occurredAt: new Date().toISOString(),
      userId: 'user-var-2',
      email: 'bob@corp.com',
    })

    const result = await validateAndRun('SELECT user_id FROM signups_v')
    expect(result.sql).toMatch(/limit\s+500/i)
  })

  it('preserves an existing LIMIT in the SQL', async () => {
    const sql = 'SELECT user_id FROM signups_v LIMIT 10'
    const result = await validateAndRun(sql)
    expect(result.sql).toBe(sql)
    expect(result.sql).not.toMatch(/limit\s+500/i)
  })

  it('executes as cthru_readonly role', async () => {
    const result = await validateAndRun('SELECT current_user AS cu')
    expect(result.rows[0]).toMatchObject({ cu: 'cthru_readonly' })
  })

  it('returns rowCount matching the number of rows returned', async () => {
    for (const [i, email] of ['a@x.com', 'b@x.com', 'c@x.com'].entries()) {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: `anon-rc-${i}`,
        occurredAt: new Date().toISOString(),
        userId: `user-rc-${i}`,
        email,
      })
    }
    const result = await validateAndRun('SELECT user_id FROM signups_v LIMIT 100')
    expect(result.rowCount).toBe(result.rows.length)
  })
})
