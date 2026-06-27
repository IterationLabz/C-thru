import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { processEvent } from '../processEvent'
import { db } from '../db'

const pastTime = new Date(Date.now() - 60_000).toISOString()

function emailHash(email: string) {
  return createHash('sha256').update(email.toLowerCase()).digest('hex')
}

describe('server event — anonymous_id derivation', () => {
  it('uses userId as anonymous_id when userId is present', async () => {
    await processEvent({
      name: 'payment_succeeded',
      source: 'server',
      userId: 'user-server-001',
      occurredAt: pastTime,
    })
    const { rows } = await db.query(
      'SELECT anonymous_id FROM events WHERE user_id = $1', ['user-server-001']
    )
    expect(rows[0].anonymous_id).toBe('user-server-001')
  })

  it('uses sha256(email) as anonymous_id when only email is present', async () => {
    await processEvent({
      name: 'payment_succeeded',
      source: 'server',
      email: 'priya@razorpay.com',
      occurredAt: pastTime,
    })
    const { rows } = await db.query(
      'SELECT anonymous_id FROM events WHERE email = $1', ['priya@razorpay.com']
    )
    expect(rows[0].anonymous_id).toBe(emailHash('priya@razorpay.com'))
  })

  it('is case-insensitive — email hash is always from lowercased email', async () => {
    await processEvent({
      name: 'payment_succeeded',
      source: 'server',
      email: 'Priya@Razorpay.COM',
      occurredAt: pastTime,
    })
    const { rows } = await db.query(
      'SELECT anonymous_id FROM events WHERE email = $1', ['Priya@Razorpay.COM']
    )
    expect(rows[0].anonymous_id).toBe(emailHash('priya@razorpay.com'))
  })

  it('rejects a server event with neither userId nor email', async () => {
    await expect(
      processEvent({ name: 'payment_succeeded', source: 'server', occurredAt: pastTime })
    ).rejects.toThrow()

    const { rows } = await db.query(
      "SELECT id FROM events WHERE name = 'payment_succeeded' AND user_id IS NULL AND email IS NULL"
    )
    expect(rows).toHaveLength(0)
  })

  it('prefers userId over email when both are present', async () => {
    await processEvent({
      name: 'payment_succeeded',
      source: 'server',
      userId: 'user-prefer-id',
      email: 'priya@razorpay.com',
      occurredAt: pastTime,
    })
    const { rows } = await db.query(
      'SELECT anonymous_id FROM events WHERE user_id = $1', ['user-prefer-id']
    )
    expect(rows[0].anonymous_id).toBe('user-prefer-id')
  })
})

describe('browser events — anonymousId still required from client', () => {
  it('throws if anonymousId is missing on an auto event', async () => {
    await expect(
      processEvent({ name: 'pageview', source: 'auto', occurredAt: new Date().toISOString() })
    ).rejects.toThrow()
  })
})
