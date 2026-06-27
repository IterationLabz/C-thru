import { describe, it, expect } from 'vitest'
import { processEvent } from '../processEvent'
import { db } from '../db'

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString()
const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()
const minutesFromNow = (n: number) => new Date(Date.now() + n * 60_000).toISOString()
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

describe('browser events (source: auto) — timestamp rules', () => {
  it('accepts a recent event and sets occurred_at_suspect = false', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-001', occurredAt: minutesAgo(1) })
    const { rows } = await db.query('SELECT occurred_at_suspect FROM events WHERE anonymous_id = $1', ['ts-001'])
    expect(rows[0].occurred_at_suspect).toBe(false)
  })

  it('rejects a browser event more than 5 minutes in the future', async () => {
    await expect(
      processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-002', occurredAt: minutesFromNow(10) })
    ).rejects.toThrow()
    const { rows } = await db.query('SELECT id FROM events WHERE anonymous_id = $1', ['ts-002'])
    expect(rows).toHaveLength(0)
  })

  it('flags a browser event older than 24 hours as suspect', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-003', occurredAt: hoursAgo(25) })
    const { rows } = await db.query('SELECT occurred_at_suspect FROM events WHERE anonymous_id = $1', ['ts-003'])
    expect(rows[0].occurred_at_suspect).toBe(true)
  })

  it('does not flag a browser event 23 hours old', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-004', occurredAt: hoursAgo(23) })
    const { rows } = await db.query('SELECT occurred_at_suspect FROM events WHERE anonymous_id = $1', ['ts-004'])
    expect(rows[0].occurred_at_suspect).toBe(false)
  })

  it('preserves the original occurred_at exactly even when flagged suspect', async () => {
    const oldTime = hoursAgo(30)
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-005', occurredAt: oldTime })
    const { rows } = await db.query('SELECT occurred_at FROM events WHERE anonymous_id = $1', ['ts-005'])
    expect(new Date(rows[0].occurred_at).toISOString()).toBe(new Date(oldTime).toISOString())
  })
})

describe('server events (source: server) — timestamp rules', () => {
  it('rejects a server event even 1 minute in the future', async () => {
    await expect(
      processEvent({ name: 'payment_succeeded', source: 'server', anonymousId: 'ts-srv-001', userId: 'u1', occurredAt: minutesFromNow(1) })
    ).rejects.toThrow()
    const { rows } = await db.query('SELECT id FROM events WHERE anonymous_id = $1', ['ts-srv-001'])
    expect(rows).toHaveLength(0)
  })

  it('flags a server event older than 7 days as suspect', async () => {
    await processEvent({ name: 'payment_succeeded', source: 'server', anonymousId: 'ts-srv-002', userId: 'u2', occurredAt: daysAgo(8) })
    const { rows } = await db.query('SELECT occurred_at_suspect FROM events WHERE anonymous_id = $1', ['ts-srv-002'])
    expect(rows[0].occurred_at_suspect).toBe(true)
  })

  it('accepts a server event 6 days old without flagging it', async () => {
    await processEvent({ name: 'payment_succeeded', source: 'server', anonymousId: 'ts-srv-003', userId: 'u3', occurredAt: daysAgo(6) })
    const { rows } = await db.query('SELECT occurred_at_suspect FROM events WHERE anonymous_id = $1', ['ts-srv-003'])
    expect(rows[0].occurred_at_suspect).toBe(false)
  })
})

describe('events_v view — occurred_at_effective', () => {
  it('returns occurred_at for a normal event', async () => {
    const t = minutesAgo(2)
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-view-001', occurredAt: t })
    const { rows } = await db.query(
      'SELECT occurred_at, occurred_at_effective FROM events_v WHERE anonymous_id = $1', ['ts-view-001']
    )
    expect(new Date(rows[0].occurred_at_effective).toISOString()).toBe(new Date(rows[0].occurred_at).toISOString())
  })

  it('returns received_at for a suspect event', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'ts-view-002', occurredAt: hoursAgo(30) })
    const { rows } = await db.query(
      'SELECT received_at, occurred_at_effective FROM events_v WHERE anonymous_id = $1', ['ts-view-002']
    )
    expect(new Date(rows[0].occurred_at_effective).toISOString()).toBe(new Date(rows[0].received_at).toISOString())
  })
})
