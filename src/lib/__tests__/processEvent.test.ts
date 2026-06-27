import { describe, it, expect } from 'vitest'
import { processEvent } from '../processEvent'
import { db } from '../db'

describe('processEvent', () => {
  it('stores a single event with the correct name, source, and anonymous_id', async () => {
    await processEvent({
      name: 'pageview',
      source: 'auto',
      anonymousId: 'anon-abc-123',
      occurredAt: new Date().toISOString(),
      properties: { url: '/home' },
    })

    const result = await db.query(
      'SELECT name, source, anonymous_id, properties FROM events WHERE anonymous_id = $1',
      ['anon-abc-123']
    )

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      name: 'pageview',
      source: 'auto',
      anonymous_id: 'anon-abc-123',
    })
    expect(result.rows[0].properties).toEqual({ url: '/home' })
  })

  it('sets received_at to server time, ignoring the client occurredAt', async () => {
    const before = new Date()

    await processEvent({
      name: 'click',
      source: 'auto',
      anonymousId: 'anon-def-456',
      // Deliberately old timestamp — received_at must still be ~now
      occurredAt: '2020-01-01T00:00:00.000Z',
      properties: {},
    })

    const after = new Date()

    const result = await db.query(
      'SELECT received_at, occurred_at FROM events WHERE anonymous_id = $1',
      ['anon-def-456']
    )

    expect(result.rows).toHaveLength(1)

    const receivedAt = new Date(result.rows[0].received_at)
    expect(receivedAt.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000)
    expect(receivedAt.getTime()).toBeLessThanOrEqual(after.getTime() + 1000)

    // occurred_at must preserve exactly what the client sent
    const occurredAt = new Date(result.rows[0].occurred_at)
    expect(occurredAt.getFullYear()).toBe(2020)
  })
})
