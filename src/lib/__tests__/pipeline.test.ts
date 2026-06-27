import { describe, it, expect } from 'vitest'
import { processEvent } from '../processEvent'
import { db } from '../db'

const now = () => new Date(Date.now() - 1000).toISOString()

describe('processEvent — users upsert', () => {
  it('creates a users row when userId is present', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-u1', userId: 'user-001', occurredAt: now() })
    const { rows } = await db.query('SELECT user_id FROM users WHERE user_id = $1', ['user-001'])
    expect(rows).toHaveLength(1)
  })

  it('does not create a users row when userId is absent', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-u2', occurredAt: now() })
    const { rows } = await db.query('SELECT user_id FROM users', [])
    expect(rows).toHaveLength(0)
  })

  it('updates last_seen on a repeat event for the same user', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-u3', userId: 'user-002', occurredAt: now() })
    await processEvent({ name: 'click', source: 'auto', anonymousId: 'anon-u3', userId: 'user-002', occurredAt: now() })
    const { rows } = await db.query('SELECT user_id FROM users WHERE user_id = $1', ['user-002'])
    expect(rows).toHaveLength(1)
  })
})

describe('processEvent — companies upsert', () => {
  it('creates a companies row for a company email domain', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-c1', email: 'priya@razorpay.com', occurredAt: now() })
    const { rows } = await db.query('SELECT domain FROM companies WHERE domain = $1', ['razorpay.com'])
    expect(rows).toHaveLength(1)
  })

  it('does not create a companies row for a personal email domain', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-c2', email: 'user@gmail.com', occurredAt: now() })
    const { rows } = await db.query('SELECT domain FROM companies', [])
    expect(rows).toHaveLength(0)
  })

  it('does not create a companies row when no email is present', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-c3', occurredAt: now() })
    const { rows } = await db.query('SELECT domain FROM companies', [])
    expect(rows).toHaveLength(0)
  })

  it('deduplicates — multiple events from same domain produce one companies row', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-c4', email: 'a@stripe.com', occurredAt: now() })
    await processEvent({ name: 'click', source: 'auto', anonymousId: 'anon-c5', email: 'b@stripe.com', occurredAt: now() })
    const { rows } = await db.query('SELECT domain FROM companies WHERE domain = $1', ['stripe.com'])
    expect(rows).toHaveLength(1)
  })
})

describe('processEvent — aliases upsert', () => {
  it('creates an aliases row mapping anonymous_id to user_id when both are present', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-a1', userId: 'user-010', occurredAt: now() })
    const { rows } = await db.query('SELECT user_id FROM aliases WHERE anonymous_id = $1', ['anon-a1'])
    expect(rows[0].user_id).toBe('user-010')
  })

  it('updates aliases with latest user_id on repeat (last-write-wins)', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-a2', userId: 'user-old', occurredAt: now() })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-a2', userId: 'user-new', occurredAt: now() })
    const { rows } = await db.query('SELECT user_id FROM aliases WHERE anonymous_id = $1', ['anon-a2'])
    expect(rows[0].user_id).toBe('user-new')
  })

  it('stores company_domain in aliases when email is a company email', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-a3', userId: 'user-011', email: 'priya@razorpay.com', occurredAt: now() })
    const { rows } = await db.query('SELECT company_domain FROM aliases WHERE anonymous_id = $1', ['anon-a3'])
    expect(rows[0].company_domain).toBe('razorpay.com')
  })

  it('stores null company_domain in aliases for personal email', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-a4', userId: 'user-012', email: 'user@gmail.com', occurredAt: now() })
    const { rows } = await db.query('SELECT company_domain FROM aliases WHERE anonymous_id = $1', ['anon-a4'])
    expect(rows[0].company_domain).toBeNull()
  })
})

describe('processEvent — best-effort semantics', () => {
  it('stores the event even if the event has no userId or email (no derived upserts)', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-best-1', occurredAt: now() })
    const { rows } = await db.query('SELECT name FROM events WHERE anonymous_id = $1', ['anon-best-1'])
    expect(rows).toHaveLength(1)
  })
})
