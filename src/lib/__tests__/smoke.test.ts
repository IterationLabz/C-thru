/**
 * v0.1 end-to-end smoke test.
 * Exercises the full happy path through every layer:
 *   ingest → storage → dashboard queries → settings CRUD
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/ingest/route'
import { getActiveUsers, getNewSignups, getTopEvents, getTopCompanies, getLiveCount } from '@/lib/dashboardQueries'
import { addKeyEvent, listKeyEvents, deleteKeyEvent } from '@/lib/keyEvents'
import { addBlockedDomain, listBlockedDomains, removeBlockedDomain } from '@/lib/blockedDomains'
import { classifyDomain } from '@/lib/domainClassifier'

const SERVER_KEY = 'test-server-key'
const WRITE_KEY = 'test-write-key'

function postEvents(body: object) {
  return POST(
    new NextRequest('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  )
}

describe('v0.1 smoke test', () => {
  it('full happy path — ingest, dashboard, settings', async () => {
    // 1. Ingest a browser event (anonymous pageview)
    const anonRes = await postEvents({
      writeKey: WRITE_KEY,
      events: [{
        name: 'pageview',
        source: 'auto',
        anonymousId: 'smoke-anon-1',
        occurredAt: new Date().toISOString(),
        url: 'https://app.example.com/dashboard',
      }],
    })
    expect(anonRes.status).toBe(200)
    const anonBody = await anonRes.json() as Array<{ accepted: boolean }>
    expect(anonBody[0]?.accepted).toBe(true)

    // 2. Ingest a server event that identifies the user with a company email
    const serverRes = await postEvents({
      serverKey: SERVER_KEY,
      events: [{
        name: 'signup_completed',
        source: 'server',
        occurredAt: new Date().toISOString(),
        userId: 'smoke-user-1',
        email: 'alice@acmecorp.com',
      }],
    })
    expect(serverRes.status).toBe(200)
    const serverBody = await serverRes.json() as Array<{ accepted: boolean }>
    expect(serverBody[0]?.accepted).toBe(true)

    // 3. Dashboard — active users
    const activeUsers = await getActiveUsers()
    expect(activeUsers.last7).toBe(1)
    expect(activeUsers.last30).toBe(1)

    // 4. Dashboard — new signups
    const signups = await getNewSignups()
    expect(signups.last7).toBe(1)

    // 5. Dashboard — top events
    const topEvents = await getTopEvents()
    const eventNames = topEvents.map(e => e.name)
    expect(eventNames).toContain('pageview')
    expect(eventNames).toContain('signup_completed')

    // 6. Dashboard — live count (both events just ingested)
    const live = await getLiveCount()
    expect(live).toBeGreaterThanOrEqual(2)

    // 7. Dashboard — companies (acmecorp.com from server event)
    const companies = await getTopCompanies()
    expect(companies[0]?.domain).toBe('acmecorp.com')
    expect(companies[0]?.eventCount).toBeGreaterThanOrEqual(1)

    // 8. Settings — add a key event
    await addKeyEvent('signup_completed')
    const keyEvents = await listKeyEvents()
    expect(keyEvents.map(e => e.name)).toContain('signup_completed')

    // 9. Settings — delete the key event
    await deleteKeyEvent('signup_completed')
    const keyEventsAfter = await listKeyEvents()
    expect(keyEventsAfter.map(e => e.name)).not.toContain('signup_completed')

    // 10. Settings — block a domain, verify classifier excludes it
    await addBlockedDomain('acmecorp.com')
    const blockedList = await listBlockedDomains()
    expect(blockedList).toContain('acmecorp.com')
    const classified = await classifyDomain('bob@acmecorp.com')
    expect(classified.companyDomain).toBeNull()

    // 11. Settings — unblock it, verify classifier picks it up again
    await removeBlockedDomain('acmecorp.com')
    const unblocked = await classifyDomain('bob@acmecorp.com')
    expect(unblocked.companyDomain).toBe('acmecorp.com')
  })

  it('rejects events without a key', async () => {
    const res = await postEvents({ events: [{ name: 'pageview', source: 'auto', anonymousId: 'x', occurredAt: new Date().toISOString() }] })
    expect(res.status).toBe(401)
  })

  it('rejects server events sent with writeKey', async () => {
    const res = await postEvents({
      writeKey: WRITE_KEY,
      events: [{ name: 'payment', source: 'server', occurredAt: new Date().toISOString(), userId: 'u1' }],
    })
    expect(res.status).toBe(403)
  })
})
