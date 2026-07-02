import { describe, it, expect } from 'vitest'
import { processEvent } from '../processEvent'
import { scoreAllCompanies, buildSignalMaps, listRules } from '../readinessEngine'
import { db } from '../db'

const now = () => new Date(Date.now() - 1000).toISOString()

describe('scoreAllCompanies — correctness', () => {
  it('returns an empty array when there are no companies', async () => {
    const scores = await scoreAllCompanies()
    expect(scores).toEqual([])
  })

  it('scores a company that meets some but not all rules', async () => {
    // acme.com: has active users + events but no payment_intent and not 7+ days in product
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-sc-1', userId: 'user-sc-1', email: 'alice@acme.com', occurredAt: now() })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-sc-2', userId: 'user-sc-2', email: 'bob@acme.com', occurredAt: now() })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-sc-3', userId: 'user-sc-3', email: 'carol@acme.com', occurredAt: now() })

    const scores = await scoreAllCompanies()
    const acme = scores.find(s => s.domain === 'acme.com')
    expect(acme).toBeDefined()
    expect(acme!.rulesTotal).toBe(5)
    // Must have exactly rulesMet ✓ entries and (rulesTotal - rulesMet) ✗ entries
    const passed = acme!.breakdown.filter(r => r.passed).length
    const failed = acme!.breakdown.filter(r => !r.passed).length
    expect(passed).toBe(acme!.rulesMet)
    expect(failed).toBe(acme!.rulesTotal - acme!.rulesMet)
    // active_users rule: 3 users → should pass (threshold = 3)
    const activeRule = acme!.breakdown.find(r => r.label.includes('Active users'))
    expect(activeRule?.passed).toBe(true)
  })

  it('returns scores sorted descending by rulesMet', async () => {
    // razorpay: 3 users, many events
    for (let i = 0; i < 3; i++) {
      await processEvent({ name: 'pageview', source: 'auto', anonymousId: `anon-rz-${i}`, userId: `user-rz-${i}`, email: `u${i}@razorpay.com`, occurredAt: now() })
    }
    for (let i = 0; i < 25; i++) {
      await processEvent({ name: 'click', source: 'auto', anonymousId: `anon-rz-0`, userId: `user-rz-0`, email: `u0@razorpay.com`, occurredAt: now() })
    }
    // startup.io: 1 user, 1 event
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-st-1', userId: 'user-st-1', email: 'x@startup.io', occurredAt: now() })

    const scores = await scoreAllCompanies()
    const domains = scores.map(s => s.domain)
    const rzIdx = domains.indexOf('razorpay.com')
    const stIdx = domains.indexOf('startup.io')
    expect(rzIdx).toBeGreaterThanOrEqual(0)
    expect(stIdx).toBeGreaterThanOrEqual(0)
    expect(rzIdx).toBeLessThan(stIdx)
  })

  it('per-rule breakdown rulesMet count matches the fraction', async () => {
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-bd-1', userId: 'user-bd-1', email: 'test@notion.so', occurredAt: now() })
    const scores = await scoreAllCompanies()
    const notion = scores.find(s => s.domain === 'notion.so')
    expect(notion).toBeDefined()
    const passedCount = notion!.breakdown.filter(r => r.passed).length
    expect(passedCount).toBe(notion!.rulesMet)
  })
})

describe('scoreAllCompanies — set-based query proof (D-21)', () => {
  it('runs at most 6 queries for any number of company domains', async () => {
    // Seed 3 companies
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-q1', userId: 'user-q1', email: 'a@alpha.com', occurredAt: now() })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-q2', userId: 'user-q2', email: 'b@beta.com', occurredAt: now() })
    await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'anon-q3', userId: 'user-q3', email: 'c@gamma.com', occurredAt: now() })

    // Instrument the pool to count queries issued during buildSignalMaps
    const rules = await listRules()
    let queryCount = 0
    const originalQuery = db.query.bind(db)
    // @ts-expect-error — temporary instrumentation
    db.query = async (...args: Parameters<typeof db.query>) => {
      queryCount++
      return originalQuery(...args)
    }

    await buildSignalMaps(rules)

    // restore
    db.query = originalQuery

    // 5 signal maps = at most 5 queries (key_event_fired may be skipped if no key event rules)
    // + listRules itself is called outside this scope, so 5 or fewer here
    expect(queryCount).toBeLessThanOrEqual(6)
  })
})
