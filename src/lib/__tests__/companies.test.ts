import { describe, it, expect } from 'vitest'
import { processEvent } from '../processEvent'
import { getTopCompanies, formatDomain } from '../dashboardQueries'

const now = new Date().toISOString()

describe('getTopCompanies', () => {
  it('returns empty array when no events', async () => {
    const result = await getTopCompanies()
    expect(result).toEqual([])
  })

  it('returns companies ranked by event count', async () => {
    // acme.com gets 2 events, corp.io gets 1
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'a1', occurredAt: now, email: 'alice@acme.com' })
    await processEvent({ name: 'click',    source: 'auto', anonymousId: 'a2', occurredAt: now, email: 'bob@acme.com' })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'a3', occurredAt: now, email: 'carol@corp.io' })

    const result = await getTopCompanies()
    expect(result[0]?.domain).toBe('acme.com')
    expect(result[0]?.eventCount).toBe(2)
    expect(result[1]?.domain).toBe('corp.io')
    expect(result[1]?.eventCount).toBe(1)
  })

  it('excludes events with no company domain (personal emails)', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'personal', occurredAt: now, email: 'user@gmail.com' })
    const result = await getTopCompanies()
    expect(result).toEqual([])
  })

  it('deduplicates the same domain across different anonymous_ids', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'x1', occurredAt: now, email: 'a@stripe.com' })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'x2', occurredAt: now, email: 'b@stripe.com' })
    const result = await getTopCompanies()
    expect(result.length).toBe(1)
    expect(result[0]?.domain).toBe('stripe.com')
    expect(result[0]?.eventCount).toBe(2)
  })

  it('returns at most 25 results', async () => {
    for (let i = 0; i < 30; i++) {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: `anon-${i}`,
        occurredAt: now,
        email: `user@company${i}.com`,
      })
    }
    const result = await getTopCompanies()
    expect(result.length).toBeLessThanOrEqual(25)
  })
})

describe('formatDomain', () => {
  it('capitalises the SLD and strips the rest', () => {
    expect(formatDomain('acme.com')).toBe('Acme')
    expect(formatDomain('stripe.io')).toBe('Stripe')
    expect(formatDomain('my-company.co.uk')).toBe('My-company')
  })

  it('handles a bare domain with no dot', () => {
    expect(formatDomain('localhost')).toBe('Localhost')
  })
})
