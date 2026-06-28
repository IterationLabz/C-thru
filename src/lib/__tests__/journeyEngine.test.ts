import { describe, it, expect } from 'vitest'
import { getJourney } from '../journeyEngine'
import { db } from '../db'

// Insert a raw event tied to a specific anonymous_id (bypasses processEvent
// to control received_at precisely for seam tests).
async function insertEvent(anonymousId: string, name: string, receivedAt: string) {
  await db.query(
    `INSERT INTO events (anonymous_id, name, source, occurred_at, received_at) VALUES ($1, $2, 'auto', $3, $3)`,
    [anonymousId, name, receivedAt]
  )
}

// Insert an alias with an explicit first_identified_at (the D-24 seam).
async function insertAlias(
  anonymousId: string,
  userId: string,
  email: string,
  firstIdentifiedAt: string
) {
  await db.query(
    `INSERT INTO users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, email]
  )
  await db.query(
    `INSERT INTO aliases (anonymous_id, user_id, email, first_identified_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (anonymous_id) DO UPDATE SET user_id = $2, email = $3, updated_at = NOW()`,
    [anonymousId, userId, email, firstIdentifiedAt]
  )
}

describe('getJourney — unknown user', () => {
  it('returns null for an unrecognised userId', async () => {
    const journey = await getJourney('no-such-user')
    expect(journey).toBeNull()
  })
})

describe('getJourney — pre-login seam (D-23)', () => {
  it('includes pre-login events that occurred before identification', async () => {
    const t1 = '2024-01-01T10:00:00Z'   // pre-login event
    const t2 = '2024-01-01T12:00:00Z'   // identification moment
    const t3 = '2024-01-01T14:00:00Z'   // post-login event

    await insertEvent('anon-pre-1', 'page_view', t1)
    await insertAlias('anon-pre-1', 'user-pre-1', 'alice@prelogin.io', t2)
    await insertEvent('anon-pre-1', 'click', t3)

    const journey = await getJourney('user-pre-1')
    expect(journey).not.toBeNull()
    expect(journey!.events).toHaveLength(2)

    // Events are sorted ascending by received_at
    expect(journey!.events[0]!.name).toBe('page_view')
    expect(journey!.events[1]!.name).toBe('click')
  })

  it('post_identification is false for events before first_identified_at', async () => {
    const t1 = '2024-02-01T09:00:00Z'   // pre-login
    const t2 = '2024-02-01T11:00:00Z'   // identification
    const t3 = '2024-02-01T13:00:00Z'   // post-login

    await insertEvent('anon-pi-1', 'early_event', t1)
    await insertAlias('anon-pi-1', 'user-pi-1', 'bob@postid.io', t2)
    await insertEvent('anon-pi-1', 'late_event', t3)

    const journey = await getJourney('user-pi-1')
    expect(journey).not.toBeNull()

    const early = journey!.events.find(e => e.name === 'early_event')
    const late  = journey!.events.find(e => e.name === 'late_event')

    expect(early!.postIdentification).toBe(false)  // before first_identified_at
    expect(late!.postIdentification).toBe(true)    // after first_identified_at
  })

  it('identificationAt in journey matches the alias first_identified_at', async () => {
    const identAt = '2024-03-15T08:30:00Z'
    await insertEvent('anon-idat-1', 'signup', identAt)
    await insertAlias('anon-idat-1', 'user-idat-1', 'carol@idat.io', identAt)

    const journey = await getJourney('user-idat-1')
    expect(journey!.identificationAt).not.toBeNull()
    // identificationAt is stored as timestamptz; compare as Date objects
    expect(new Date(journey!.identificationAt!).getTime()).toBe(new Date(identAt).getTime())
  })

  it('pre-login events render BEFORE the identification marker', async () => {
    const tPre    = '2024-04-01T06:00:00Z'
    const tIdent  = '2024-04-01T10:00:00Z'
    const tPost   = '2024-04-01T14:00:00Z'

    await insertEvent('anon-order-1', 'anon_browse', tPre)
    await insertAlias('anon-order-1', 'user-order-1', 'dave@order.io', tIdent)
    await insertEvent('anon-order-1', 'post_action', tPost)

    const journey = await getJourney('user-order-1')
    const events = journey!.events

    // First event is before identification
    expect(events[0]!.postIdentification).toBe(false)
    // Last event is after identification
    expect(events[events.length - 1]!.postIdentification).toBe(true)

    // All pre-id events come before all post-id events in the sorted list
    const firstPostIdx = events.findIndex(e => e.postIdentification)
    const lastPreIdx   = events.map(e => e.postIdentification).lastIndexOf(false)
    if (firstPostIdx !== -1 && lastPreIdx !== -1) {
      expect(lastPreIdx).toBeLessThan(firstPostIdx)
    }
  })
})

describe('getJourney — multiple anonymous IDs', () => {
  it('includes events from all anonymous_ids linked to the user', async () => {
    const t1 = '2024-05-01T10:00:00Z'
    const t2 = '2024-05-01T11:00:00Z'
    const identAt = '2024-05-01T12:00:00Z'

    // Two devices, same user
    await insertEvent('anon-multi-1', 'mobile_view', t1)
    await insertEvent('anon-multi-2', 'desktop_view', t2)
    await insertAlias('anon-multi-1', 'user-multi-1', 'eve@multi.io', identAt)
    await insertAlias('anon-multi-2', 'user-multi-1', 'eve@multi.io', identAt)

    const journey = await getJourney('user-multi-1')
    const names = journey!.events.map(e => e.name)
    expect(names).toContain('mobile_view')
    expect(names).toContain('desktop_view')
  })
})
