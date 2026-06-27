import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, OPTIONS } from '../route'

const TEST_WRITE_KEY = 'test-write-key'
const TEST_SERVER_KEY = 'test-server-key'

function makeRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const baseAutoEvent = {
  name: 'pageview',
  source: 'auto' as const,
  anonymousId: 'anon-route-test-001',
  occurredAt: new Date().toISOString(),
}

describe('POST /api/ingest — auth', () => {
  it('returns 401 when no key is provided', async () => {
    const res = await POST(makeRequest({ events: [baseAutoEvent] }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when writeKey is incorrect', async () => {
    const res = await POST(makeRequest({ writeKey: 'wrong-key', events: [baseAutoEvent] }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when serverKey is incorrect', async () => {
    const res = await POST(makeRequest({ serverKey: 'wrong-key', events: [{ ...baseAutoEvent, source: 'server' }] }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when writeKey is used to submit a server event', async () => {
    const res = await POST(makeRequest({
      writeKey: TEST_WRITE_KEY,
      events: [{ ...baseAutoEvent, source: 'server' }],
    }))
    expect(res.status).toBe(403)
  })

  it('accepts a valid writeKey with auto events and returns 200', async () => {
    const res = await POST(makeRequest({ writeKey: TEST_WRITE_KEY, events: [baseAutoEvent] }))
    expect(res.status).toBe(200)
  })

  it('accepts a valid writeKey with custom events and returns 200', async () => {
    const res = await POST(makeRequest({
      writeKey: TEST_WRITE_KEY,
      events: [{ ...baseAutoEvent, source: 'custom', name: 'invited_teammate' }],
    }))
    expect(res.status).toBe(200)
  })

  it('accepts a valid serverKey with server events and returns 200', async () => {
    const res = await POST(makeRequest({
      serverKey: TEST_SERVER_KEY,
      events: [{ ...baseAutoEvent, source: 'server', userId: 'user-abc' }],
    }))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/ingest — per-event response', () => {
  it('returns a per-event status array with accepted: true for a valid event', async () => {
    const res = await POST(makeRequest({ writeKey: TEST_WRITE_KEY, events: [baseAutoEvent] }))
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ accepted: true })
  })

  it('returns one status entry per event in a batch', async () => {
    const res = await POST(makeRequest({
      writeKey: TEST_WRITE_KEY,
      events: [baseAutoEvent, { ...baseAutoEvent, anonymousId: 'anon-route-test-002', name: 'click' }],
    }))
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({ accepted: true })
    expect(body[1]).toMatchObject({ accepted: true })
  })
})

describe('OPTIONS /api/ingest — CORS preflight', () => {
  it('returns 204 with CORS headers', async () => {
    const res = await OPTIONS()
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST')
  })
})
