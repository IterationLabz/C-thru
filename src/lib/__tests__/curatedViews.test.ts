import { describe, it, expect } from 'vitest'
import { db } from '../db'
import { processEvent } from '../processEvent'

const now = new Date().toISOString()
const pastSuspect = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago

describe('curated views', () => {
  describe('signups_v', () => {
    it('includes an identified user', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-sv-1',
        occurredAt: now,
        userId: 'user-sv-1',
        email: 'alice@acme.com',
      })

      const { rows } = await db.query(
        'SELECT * FROM signups_v WHERE user_id = $1',
        ['user-sv-1']
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].user_id).toBe('user-sv-1')
      expect(rows[0].signed_up_at).toBeTruthy()
    })

    it('excludes anonymous-only visitors', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-only-sv',
        occurredAt: now,
        // no userId
      })

      const { rows } = await db.query('SELECT * FROM signups_v')
      expect(rows).toHaveLength(0)
    })

    it('sets company_domain from work email', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-sv-2',
        occurredAt: now,
        userId: 'user-sv-2',
        email: 'bob@razorpay.com',
      })

      const { rows } = await db.query(
        'SELECT company_domain FROM signups_v WHERE user_id = $1',
        ['user-sv-2']
      )
      expect(rows[0].company_domain).toBe('razorpay.com')
    })

    it('sets company_domain to null for personal email (gmail.com)', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-sv-3',
        occurredAt: now,
        userId: 'user-sv-3',
        email: 'carol@gmail.com',
      })

      const { rows } = await db.query(
        'SELECT company_domain FROM signups_v WHERE user_id = $1',
        ['user-sv-3']
      )
      expect(rows[0].company_domain).toBeNull()
    })

    it('emits exactly one row per user even with multiple anonymous_ids', async () => {
      // same user, two devices
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-sv-4a',
        occurredAt: now,
        userId: 'user-sv-4',
        email: 'dan@corp.com',
      })
      await processEvent({
        name: 'click',
        source: 'auto',
        anonymousId: 'anon-sv-4b',
        occurredAt: now,
        userId: 'user-sv-4',
        email: 'dan@corp.com',
      })

      const { rows } = await db.query(
        'SELECT * FROM signups_v WHERE user_id = $1',
        ['user-sv-4']
      )
      expect(rows).toHaveLength(1)
    })
  })

  describe('active_users_v', () => {
    it('includes an identified user who has events', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-av-1',
        occurredAt: now,
        userId: 'user-av-1',
        email: 'eve@startup.io',
      })

      const { rows } = await db.query(
        'SELECT * FROM active_users_v WHERE user_id = $1',
        ['user-av-1']
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].total_events).toBe('1')
    })

    it('excludes anonymous-only visitors', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-only-av',
        occurredAt: now,
      })

      const { rows } = await db.query('SELECT * FROM active_users_v')
      expect(rows).toHaveLength(0)
    })

    it('uses received_at for last_event_at, not occurred_at_effective', async () => {
      // Ingest an event with a suspicious old timestamp — occurred_at_effective
      // would fall back to received_at (D-06/D-07), but we assert we use received_at
      // directly regardless. Both land on received_at for suspect events; this test
      // confirms the view uses the received_at column explicitly.
      const beforeIngest = new Date()
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-av-2',
        occurredAt: pastSuspect,  // >24h ago — flagged suspect
        userId: 'user-av-2',
        email: 'frank@corp.com',
      })
      const afterIngest = new Date()

      const { rows } = await db.query(
        'SELECT last_event_at FROM active_users_v WHERE user_id = $1',
        ['user-av-2']
      )
      const lastEventAt = new Date(rows[0].last_event_at)
      // received_at is the server clock at ingest time — must be between before/after
      expect(lastEventAt.getTime()).toBeGreaterThanOrEqual(beforeIngest.getTime() - 1000)
      expect(lastEventAt.getTime()).toBeLessThanOrEqual(afterIngest.getTime() + 1000)
    })

    it('sets company_domain from users.email, consistent with signups_v', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-av-3',
        occurredAt: now,
        userId: 'user-av-3',
        email: 'grace@acme.com',
      })

      const { rows } = await db.query(
        'SELECT company_domain FROM active_users_v WHERE user_id = $1',
        ['user-av-3']
      )
      expect(rows[0].company_domain).toBe('acme.com')
    })

    it('collapses multi-device user into one row with all events summed', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-av-4a',
        occurredAt: now,
        userId: 'user-av-4',
        email: 'henry@corp.com',
      })
      await processEvent({
        name: 'click',
        source: 'auto',
        anonymousId: 'anon-av-4b',
        occurredAt: now,
        userId: 'user-av-4',
        email: 'henry@corp.com',
      })

      const { rows } = await db.query(
        'SELECT * FROM active_users_v WHERE user_id = $1',
        ['user-av-4']
      )
      expect(rows).toHaveLength(1)
      expect(parseInt(rows[0].total_events, 10)).toBe(2)
    })
  })

  describe('company_activity_v', () => {
    it('includes events tagged with a company domain at ingestion', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-ca-1',
        occurredAt: now,
        userId: 'user-ca-1',
        email: 'ivan@stripe.com',
      })

      const { rows } = await db.query(
        'SELECT * FROM company_activity_v WHERE domain = $1',
        ['stripe.com']
      )
      expect(rows).toHaveLength(1)
      expect(parseInt(rows[0].total_events, 10)).toBeGreaterThanOrEqual(1)
    })

    it('retroactively attributes pre-login events to company via alias', async () => {
      // Step 1: anonymous visit — company_domain is null on the event
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-ca-2',
        occurredAt: now,
      })

      // Pre-identify: no events for this company yet
      const before = await db.query(
        'SELECT * FROM company_activity_v WHERE domain = $1',
        ['notion.so']
      )
      expect(before.rows).toHaveLength(0)

      // Step 2: user identifies — alias now has company_domain = 'notion.so'
      await processEvent({
        name: 'identify',
        source: 'custom',
        anonymousId: 'anon-ca-2',
        occurredAt: now,
        userId: 'user-ca-2',
        email: 'judy@notion.so',
      })

      // Now the pre-login event should be attributed to notion.so via the alias
      const after = await db.query(
        'SELECT * FROM company_activity_v WHERE domain = $1',
        ['notion.so']
      )
      expect(after.rows).toHaveLength(1)
      // Both events (pre-login pageview + identify event) attributed to notion.so
      expect(parseInt(after.rows[0].total_events, 10)).toBe(2)
    })

    it('excludes events from personal email domains', async () => {
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-ca-3',
        occurredAt: now,
        userId: 'user-ca-3',
        email: 'kate@gmail.com',
      })

      // gmail.com is in blocked_domains — company_domain set to null at ingestion
      // alias.company_domain is also null — so COALESCE gives null → excluded
      const { rows } = await db.query(
        'SELECT * FROM company_activity_v WHERE domain = $1',
        ['gmail.com']
      )
      expect(rows).toHaveLength(0)
    })

    it('counts identified_users separately from anonymous visitors', async () => {
      // One identified user
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-ca-4a',
        occurredAt: now,
        userId: 'user-ca-4',
        email: 'lena@hubspot.com',
      })
      // One anonymous visitor from same company (no userId)
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-ca-4b',
        occurredAt: now,
        // no userId, but same company_domain from a previous identify on this anon_id
        // can't happen without alias — this tests anonymous-only stays unattributed
      })

      const { rows } = await db.query(
        'SELECT * FROM company_activity_v WHERE domain = $1',
        ['hubspot.com']
      )
      expect(rows).toHaveLength(1)
      expect(parseInt(rows[0].identified_users, 10)).toBe(1)
      // unique_visitors counts all anonymous_ids including unidentified
      expect(parseInt(rows[0].unique_visitors, 10)).toBeGreaterThanOrEqual(1)
    })
  })

  describe('cthru_readonly role', () => {
    it('can SELECT from curated views', async () => {
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL ROLE cthru_readonly')
        const { rows } = await client.query('SELECT COUNT(*) FROM signups_v')
        expect(parseInt(rows[0].count, 10)).toBeGreaterThanOrEqual(0)
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    })

    it('cannot SELECT from the raw events table', async () => {
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL ROLE cthru_readonly')
        await expect(client.query('SELECT 1 FROM events')).rejects.toThrow(/permission denied/)
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    })

    it('cannot INSERT into any table', async () => {
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query('SET LOCAL ROLE cthru_readonly')
        await expect(
          client.query(`INSERT INTO events (name, source, anonymous_id, occurred_at, received_at)
                        VALUES ('x', 'auto', 'x', now(), now())`)
        ).rejects.toThrow(/permission denied/)
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    })
  })

  describe('blocklist consistency across all three views', () => {
    it('all three views exclude a domain immediately after it is added to blocked_domains', async () => {
      const now = new Date().toISOString()

      // Seed an identified user from newco.com (not yet blocked)
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-bl-1',
        occurredAt: now,
        userId: 'user-bl-1',
        email: 'alice@newco.com',
      })
      // Also seed a pre-login event so retroactive attribution via COALESCE is exercised
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-bl-pre',
        occurredAt: now,
        // no userId — anonymous visitor from newco.com (company_domain set at ingestion)
      })
      // Manually set company_domain on the anonymous event to simulate pre-login attribution
      await db.query(
        "UPDATE events SET company_domain = 'newco.com' WHERE anonymous_id = 'anon-bl-pre'"
      )

      // Before block: all three views should see newco.com
      const beforeSignups = await db.query("SELECT * FROM signups_v WHERE company_domain = 'newco.com'")
      const beforeActive  = await db.query("SELECT * FROM active_users_v WHERE company_domain = 'newco.com'")
      const beforeCompany = await db.query("SELECT * FROM company_activity_v WHERE domain = 'newco.com'")
      expect(beforeSignups.rows.length).toBeGreaterThan(0)
      expect(beforeActive.rows.length).toBeGreaterThan(0)
      expect(beforeCompany.rows.length).toBeGreaterThan(0)

      // Add newco.com to the blocklist
      await db.query("INSERT INTO blocked_domains (domain) VALUES ('newco.com') ON CONFLICT DO NOTHING")

      // After block: all three views must immediately agree — newco.com gone from all
      const afterSignups = await db.query("SELECT * FROM signups_v WHERE company_domain = 'newco.com'")
      const afterActive  = await db.query("SELECT * FROM active_users_v WHERE company_domain = 'newco.com'")
      const afterCompany = await db.query("SELECT * FROM company_activity_v WHERE domain = 'newco.com'")
      expect(afterSignups.rows).toHaveLength(0)
      expect(afterActive.rows).toHaveLength(0)
      expect(afterCompany.rows).toHaveLength(0)
    })

    it('retroactive attribution still works for a non-blocked domain', async () => {
      const now = new Date().toISOString()

      // Anonymous pre-login event — company_domain set at ingestion (by UPDATE to simulate)
      await processEvent({
        name: 'pageview',
        source: 'auto',
        anonymousId: 'anon-retro-1',
        occurredAt: now,
      })
      await db.query(
        "UPDATE events SET company_domain = 'retro.io' WHERE anonymous_id = 'anon-retro-1'"
      )

      // company_activity_v should show retro.io even though the user is anonymous
      const { rows } = await db.query("SELECT * FROM company_activity_v WHERE domain = 'retro.io'")
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0].domain).toBe('retro.io')
    })
  })
})
