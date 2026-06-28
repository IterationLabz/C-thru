import { describe, it, expect } from 'vitest'
import { evaluateSignal, listRules, type ReadinessRule, type SignalMaps } from '../readinessEngine'
import { db } from '../db'

// Minimal rule factory — only the fields evaluateSignal uses
function rule(overrides: Partial<ReadinessRule> & { signal: ReadinessRule['signal'] }): ReadinessRule {
  return {
    id: 1,
    label: 'test rule',
    operator: '>=',
    threshold: 3,
    window_days: 30,
    event_name: null,
    ...overrides,
  }
}

function emptyMaps(): SignalMaps {
  return {
    activeUsers: new Map(),
    totalEvents: new Map(),
    lastEventDaysAgo: new Map(),
    keyEventFired: new Map(),
    daysInProduct: new Map(),
  }
}

describe('evaluateSignal — active_users branch', () => {
  it('passes when domain count meets the >= threshold', () => {
    const maps = emptyMaps()
    maps.activeUsers.set('acme.com', 5)
    const result = evaluateSignal(rule({ signal: 'active_users', threshold: 3 }), 'acme.com', maps)
    expect(result.passed).toBe(true)
    expect(result.value).toBe('5 users')
  })

  it('fails when domain count is below the >= threshold', () => {
    const maps = emptyMaps()
    maps.activeUsers.set('acme.com', 2)
    const result = evaluateSignal(rule({ signal: 'active_users', threshold: 3 }), 'acme.com', maps)
    expect(result.passed).toBe(false)
    expect(result.value).toBe('2 users')
  })

  it('fails with 0 users when domain is absent from map', () => {
    const result = evaluateSignal(rule({ signal: 'active_users', threshold: 3 }), 'unknown.io', emptyMaps())
    expect(result.passed).toBe(false)
    expect(result.value).toBe('0 users')
  })
})

describe('evaluateSignal — total_events branch', () => {
  it('passes when domain event count meets the threshold', () => {
    const maps = emptyMaps()
    maps.totalEvents.set('stripe.com', 47)
    const result = evaluateSignal(rule({ signal: 'total_events', threshold: 20 }), 'stripe.com', maps)
    expect(result.passed).toBe(true)
    expect(result.value).toBe('47 events')
  })

  it('fails when domain event count is below threshold', () => {
    const maps = emptyMaps()
    maps.totalEvents.set('stripe.com', 5)
    const result = evaluateSignal(rule({ signal: 'total_events', threshold: 20 }), 'stripe.com', maps)
    expect(result.passed).toBe(false)
  })
})

describe('evaluateSignal — days_since_active branch', () => {
  it('passes (<=) when domain was active within the window', () => {
    const maps = emptyMaps()
    maps.lastEventDaysAgo.set('notion.so', 3)
    const result = evaluateSignal(
      rule({ signal: 'days_since_active', operator: '<=', threshold: 14 }),
      'notion.so',
      maps
    )
    expect(result.passed).toBe(true)
    expect(result.value).toContain('3 days ago')
  })

  it('fails when domain has never been active', () => {
    const result = evaluateSignal(
      rule({ signal: 'days_since_active', operator: '<=', threshold: 14 }),
      'ghost.io',
      emptyMaps()
    )
    expect(result.passed).toBe(false)
    expect(result.value).toBe('never active')
  })

  it('formats today and 1 day ago correctly', () => {
    const maps = emptyMaps()
    maps.lastEventDaysAgo.set('a.com', 0)
    maps.lastEventDaysAgo.set('b.com', 1)
    expect(evaluateSignal(rule({ signal: 'days_since_active', operator: '<=', threshold: 14 }), 'a.com', maps).value)
      .toContain('today')
    expect(evaluateSignal(rule({ signal: 'days_since_active', operator: '<=', threshold: 14 }), 'b.com', maps).value)
      .toContain('1 day ago')
  })
})

describe('evaluateSignal — key_event_fired branch', () => {
  it('passes when the event name is in the fired set', () => {
    const maps = emptyMaps()
    maps.keyEventFired.set('razorpay.com', new Set(['payment_intent', 'pageview']))
    const result = evaluateSignal(
      rule({ signal: 'key_event_fired', event_name: 'payment_intent' }),
      'razorpay.com',
      maps
    )
    expect(result.passed).toBe(true)
    expect(result.value).toBe('fired payment_intent')
  })

  it('fails when the event name is NOT in the fired set', () => {
    const maps = emptyMaps()
    maps.keyEventFired.set('razorpay.com', new Set(['pageview']))
    const result = evaluateSignal(
      rule({ signal: 'key_event_fired', event_name: 'payment_intent' }),
      'razorpay.com',
      maps
    )
    expect(result.passed).toBe(false)
    expect(result.value).toBe('payment_intent never fired')
  })

  it('fails when domain has no events at all', () => {
    const result = evaluateSignal(
      rule({ signal: 'key_event_fired', event_name: 'payment_intent' }),
      'unknown.io',
      emptyMaps()
    )
    expect(result.passed).toBe(false)
  })
})

describe('evaluateSignal — days_in_product branch', () => {
  it('passes when domain has been in product >= threshold days', () => {
    const maps = emptyMaps()
    maps.daysInProduct.set('hubspot.com', 14)
    const result = evaluateSignal(
      rule({ signal: 'days_in_product', threshold: 7 }),
      'hubspot.com',
      maps
    )
    expect(result.passed).toBe(true)
    expect(result.value).toBe('14 days')
  })

  it('fails when no signups for that domain', () => {
    const result = evaluateSignal(
      rule({ signal: 'days_in_product', threshold: 7 }),
      'newco.io',
      emptyMaps()
    )
    expect(result.passed).toBe(false)
    expect(result.value).toBe('no signups')
  })

  it('fails when domain has been in product fewer days than threshold', () => {
    const maps = emptyMaps()
    maps.daysInProduct.set('newco.io', 2)
    const result = evaluateSignal(
      rule({ signal: 'days_in_product', threshold: 7 }),
      'newco.io',
      maps
    )
    expect(result.passed).toBe(false)
  })
})

describe('readiness_rules table — DB integration', () => {
  it('migration seeds 5 default rules, one per signal type', async () => {
    const rules = await listRules()
    const signals = rules.map(r => r.signal)
    expect(signals).toContain('active_users')
    expect(signals).toContain('total_events')
    expect(signals).toContain('days_since_active')
    expect(signals).toContain('key_event_fired')
    expect(signals).toContain('days_in_product')
    expect(rules.length).toBeGreaterThanOrEqual(5)
  })

  it('default rules have valid operator, threshold, and label', async () => {
    const rules = await listRules()
    for (const r of rules) {
      expect(['>=', '<=']).toContain(r.operator)
      expect(typeof r.threshold).toBe('number')
      expect(r.label.length).toBeGreaterThan(0)
    }
  })

  it('can insert and retrieve a custom rule', async () => {
    await db.query(
      `INSERT INTO readiness_rules (label, signal, operator, threshold, window_days)
       VALUES ('Custom test rule', 'total_events', '>=', 10, 14)`
    )
    const rules = await listRules()
    const custom = rules.find(r => r.label === 'Custom test rule')
    expect(custom).toBeDefined()
    expect(custom!.signal).toBe('total_events')
    expect(custom!.threshold).toBe(10)
    expect(custom!.window_days).toBe(14)
  })
})
