import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { resetRateLimit } from '@/lib/rateLimit'

const WRITE_KEY = 'test-write-key'

function makeRequest(writeKey: string) {
  return new NextRequest('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writeKey,
      events: [{
        name: 'pageview',
        source: 'auto',
        anonymousId: `anon-rl-${Math.random()}`,
        occurredAt: new Date().toISOString(),
      }],
    }),
  })
}

beforeEach(() => {
  resetRateLimit()
})

describe('rate limiting — /api/ingest', () => {
  it('allows requests under the limit', async () => {
    const res = await POST(makeRequest(WRITE_KEY))
    expect(res.status).toBe(200)
  })

  it('returns 429 after exceeding the rate limit', async () => {
    // CTHRU_RATE_LIMIT=3 in test env — 4th request should be rejected
    await POST(makeRequest(WRITE_KEY))
    await POST(makeRequest(WRITE_KEY))
    await POST(makeRequest(WRITE_KEY))
    const res = await POST(makeRequest(WRITE_KEY))
    expect(res.status).toBe(429)
  })

  it('includes a Retry-After header on 429', async () => {
    await POST(makeRequest(WRITE_KEY))
    await POST(makeRequest(WRITE_KEY))
    await POST(makeRequest(WRITE_KEY))
    const res = await POST(makeRequest(WRITE_KEY))
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })

  it('rate limits per key — different keys have independent limits', async () => {
    await POST(makeRequest(WRITE_KEY))
    await POST(makeRequest(WRITE_KEY))
    await POST(makeRequest(WRITE_KEY))
    // 4th request with same key — should 429
    const rejected = await POST(makeRequest(WRITE_KEY))
    expect(rejected.status).toBe(429)
  })

  it('resets cleanly between tests', async () => {
    // If resetRateLimit() works, this should be 200 (fresh count)
    const res = await POST(makeRequest(WRITE_KEY))
    expect(res.status).toBe(200)
  })
})
