import { describe, it, expect } from 'vitest'
import { processEvent } from '../processEvent'
import { getActiveUsers, getNewSignups, getTopEvents, getLiveCount } from '../dashboardQueries'

const now = new Date().toISOString()

describe('dashboard queries', () => {
  describe('getActiveUsers', () => {
    it('returns zero when no events', async () => {
      const result = await getActiveUsers()
      expect(result.last7).toBe(0)
      expect(result.last30).toBe(0)
    })

    it('counts identified users with a recent event', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-au-1',
        occurredAt: now,
        userId: 'user-au-1',
        email: 'alice@acme.com',
      })
      const result = await getActiveUsers()
      expect(result.last7).toBe(1)
      expect(result.last30).toBe(1)
    })

    it('does not count anonymous-only events', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-only',
        occurredAt: now,
      })
      const result = await getActiveUsers()
      expect(result.last7).toBe(0)
      expect(result.last30).toBe(0)
    })

    it('deduplicates the same user across multiple events', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-dup',
        occurredAt: now,
        userId: 'user-dup',
      })
      await processEvent({
        name: 'click',
        source: 'auto',
        anonymousId: 'anon-dup',
        occurredAt: now,
        userId: 'user-dup',
      })
      const result = await getActiveUsers()
      expect(result.last7).toBe(1)
    })
  })

  describe('getNewSignups', () => {
    it('returns zero when no users', async () => {
      const result = await getNewSignups()
      expect(result.last7).toBe(0)
      expect(result.last30).toBe(0)
    })

    it('counts a user whose first_seen is now', async () => {
      await processEvent({
        name: 'signup',
        source: 'custom',
        anonymousId: 'anon-ns-1',
        occurredAt: now,
        userId: 'user-ns-1',
        email: 'bob@corp.com',
      })
      const result = await getNewSignups()
      expect(result.last7).toBe(1)
      expect(result.last30).toBe(1)
    })
  })

  describe('getTopEvents', () => {
    it('returns empty array when no events', async () => {
      const result = await getTopEvents()
      expect(result).toEqual([])
    })

    it('ranks events by count descending', async () => {
      await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'te-1', occurredAt: now })
      await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'te-2', occurredAt: now })
      await processEvent({ name: 'click', source: 'auto', anonymousId: 'te-3', occurredAt: now })
      const result = await getTopEvents()
      expect(result[0]).toEqual({ name: 'pageview', count: 2 })
      expect(result[1]).toEqual({ name: 'click', count: 1 })
    })

    it('returns at most 10 results', async () => {
      for (let i = 0; i < 12; i++) {
        await processEvent({
          name: `event_${i}`,
          source: 'auto',
          anonymousId: `anon-top-${i}`,
          occurredAt: now,
        })
      }
      const result = await getTopEvents()
      expect(result.length).toBeLessThanOrEqual(10)
    })
  })

  describe('getLiveCount', () => {
    it('returns zero when no events', async () => {
      const result = await getLiveCount()
      expect(result).toBe(0)
    })

    it('counts events ingested within the last 60 seconds', async () => {
      await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'lc-1', occurredAt: now })
      await processEvent({ name: 'pageview', source: 'auto', anonymousId: 'lc-2', occurredAt: now })
      const result = await getLiveCount()
      expect(result).toBe(2)
    })
  })
})
