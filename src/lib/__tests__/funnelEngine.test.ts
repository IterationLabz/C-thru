import { describe, it, expect } from 'vitest'
import { validateFunnelSteps, evaluateFunnel } from '../funnelEngine'
import { processEvent } from '../processEvent'

const now = () => new Date(Date.now() - 1000).toISOString()

describe('validateFunnelSteps — batched ANY() event-name check', () => {
  it('returns valid=true and empty unknownEvents for empty input', async () => {
    const result = await validateFunnelSteps([])
    expect(result.valid).toBe(true)
    expect(result.unknownEvents).toHaveLength(0)
  })

  it('flags event names that have never been fired', async () => {
    const result = await validateFunnelSteps(['never_fired_event_xyz'])
    expect(result.valid).toBe(false)
    expect(result.unknownEvents).toContain('never_fired_event_xyz')
  })

  it('returns valid=true for event names that exist', async () => {
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-val-1', userId: 'user-val-1', email: 'alice@valid.io', occurredAt: now() })
    const result = await validateFunnelSteps(['signup'])
    expect(result.valid).toBe(true)
    expect(result.unknownEvents).toHaveLength(0)
  })

  it('returns only the unknown names in a mixed list', async () => {
    await processEvent({ name: 'page_view', source: 'auto', anonymousId: 'anon-val-2', userId: 'user-val-2', email: 'bob@valid.io', occurredAt: now() })
    const result = await validateFunnelSteps(['page_view', 'typo_event_abc'])
    expect(result.valid).toBe(false)
    expect(result.unknownEvents).toEqual(['typo_event_abc'])
    expect(result.unknownEvents).not.toContain('page_view')
  })
})

describe('evaluateFunnel — user mode', () => {
  it('returns empty steps for empty input', async () => {
    const result = await evaluateFunnel({ steps: [], mode: 'user' })
    expect(result.steps).toHaveLength(0)
  })

  it('counts users who fired a single step event', async () => {
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-fu-1', userId: 'user-fu-1', email: 'a@funnel.io', occurredAt: now() })
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-fu-2', userId: 'user-fu-2', email: 'b@funnel.io', occurredAt: now() })
    const result = await evaluateFunnel({ steps: [{ eventName: 'signup' }], mode: 'user' })
    expect(result.steps[0]!.count).toBe(2)
    expect(result.steps[0]!.dropoffPct).toBe(0)
  })

  it('narrows count at each step (users must complete all prior steps)', async () => {
    // user-fn-1: signup + activate
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-fn-1', userId: 'user-fn-1', email: 'c@fnarrow.io', occurredAt: now() })
    await processEvent({ name: 'activate', source: 'auto', anonymousId: 'anon-fn-1', userId: 'user-fn-1', email: 'c@fnarrow.io', occurredAt: now() })
    // user-fn-2: signup only
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-fn-2', userId: 'user-fn-2', email: 'd@fnarrow.io', occurredAt: now() })

    const result = await evaluateFunnel({
      steps: [{ eventName: 'signup' }, { eventName: 'activate' }],
      mode: 'user',
    })

    expect(result.steps[0]!.count).toBe(2)  // both users signed up
    expect(result.steps[1]!.count).toBe(1)  // only one activated
    expect(result.steps[1]!.dropoffPct).toBe(50)
  })

  it('first step always has dropoffPct = 0', async () => {
    await processEvent({ name: 'click', source: 'auto', anonymousId: 'anon-fn-3', userId: 'user-fn-3', email: 'e@drop.io', occurredAt: now() })
    const result = await evaluateFunnel({ steps: [{ eventName: 'click' }], mode: 'user' })
    expect(result.steps[0]!.dropoffPct).toBe(0)
  })

  it('returns zero count for a step no user completed', async () => {
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-fn-4', userId: 'user-fn-4', email: 'f@zero.io', occurredAt: now() })
    const result = await evaluateFunnel({
      steps: [{ eventName: 'signup' }, { eventName: 'payment_complete' }],
      mode: 'user',
    })
    expect(result.steps[1]!.count).toBe(0)
    expect(result.steps[1]!.dropoffPct).toBe(100)
  })
})

describe('evaluateFunnel — company mode', () => {
  it('counts companies whose users completed the step', async () => {
    // Two users from same company both signed up
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-co-1', userId: 'user-co-1', email: 'x@corpco.com', occurredAt: now() })
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-co-2', userId: 'user-co-2', email: 'y@corpco.com', occurredAt: now() })
    // One user from a different company
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-co-3', userId: 'user-co-3', email: 'z@othercorp.com', occurredAt: now() })

    const result = await evaluateFunnel({ steps: [{ eventName: 'signup' }], mode: 'company' })
    // 2 companies (corpco.com, othercorp.com) had signups
    expect(result.steps[0]!.count).toBe(2)
  })

  it('narrows to companies where any user completed both steps', async () => {
    // corpA: user signed up AND activated
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-ca-1', userId: 'user-ca-1', email: 'a@corpa.io', occurredAt: now() })
    await processEvent({ name: 'activate', source: 'auto', anonymousId: 'anon-ca-1', userId: 'user-ca-1', email: 'a@corpa.io', occurredAt: now() })
    // corpB: user signed up only
    await processEvent({ name: 'signup', source: 'auto', anonymousId: 'anon-cb-1', userId: 'user-cb-1', email: 'b@corpb.io', occurredAt: now() })

    const result = await evaluateFunnel({
      steps: [{ eventName: 'signup' }, { eventName: 'activate' }],
      mode: 'company',
    })
    expect(result.steps[0]!.count).toBe(2)
    expect(result.steps[1]!.count).toBe(1)
  })
})

describe('evaluateFunnel — injection safety', () => {
  it('handles event names with SQL special characters without crashing', async () => {
    // This would be a SQL injection attempt if names were interpolated
    const result = await evaluateFunnel({
      steps: [{ eventName: "'; DROP TABLE events; --" }],
      mode: 'user',
    })
    // Should return 0 (event never fired) without crashing
    expect(result.steps[0]!.count).toBe(0)
  })
})
