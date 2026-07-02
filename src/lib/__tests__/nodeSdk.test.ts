import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Cthru } from '@cthru/node'

const HOST = 'http://localhost:3000'
const SERVER_KEY = 'test-server-key'

function makeClient() {
  return new Cthru({ host: HOST, serverKey: SERVER_KEY })
}

function lastFetchBody() {
  const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls
  return JSON.parse(calls[calls.length - 1]![1]!.body)
}

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ accepted: true }]),
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Cthru.trackServer() — happy path', () => {
  it('sends a POST to /api/ingest with the serverKey', async () => {
    await makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(url).toBe(`${HOST}/api/ingest`)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.serverKey).toBe(SERVER_KEY)
  })

  it('sends source: server on the event', async () => {
    await makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    expect(lastFetchBody().events[0].source).toBe('server')
  })

  it('includes the event name', async () => {
    await makeClient().trackServer('subscription_renewed', { userId: 'u1' })
    expect(lastFetchBody().events[0].name).toBe('subscription_renewed')
  })

  it('includes userId when provided', async () => {
    await makeClient().trackServer('payment_succeeded', { userId: 'user-42' })
    expect(lastFetchBody().events[0].userId).toBe('user-42')
  })

  it('includes email when provided', async () => {
    await makeClient().trackServer('payment_succeeded', { email: 'a@acme.com' })
    expect(lastFetchBody().events[0].email).toBe('a@acme.com')
  })

  it('passes extra properties through', async () => {
    await makeClient().trackServer('payment_succeeded', { userId: 'u1', amount: 499, plan: 'pro' })
    const props = lastFetchBody().events[0].properties
    expect(props).toMatchObject({ amount: 499, plan: 'pro' })
  })

  it('resolves to void on success', async () => {
    await expect(
      makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    ).resolves.toBeUndefined()
  })
})

describe('Cthru.trackServer() — identity validation', () => {
  it('throws if neither userId nor email is provided', async () => {
    await expect(
      makeClient().trackServer('payment_succeeded', {})
    ).rejects.toThrow()
  })

  it('does not call fetch if identity is missing', async () => {
    await makeClient().trackServer('payment_succeeded', {}).catch(() => {})
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('accepts userId without email', async () => {
    await expect(
      makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    ).resolves.toBeUndefined()
  })

  it('accepts email without userId', async () => {
    await expect(
      makeClient().trackServer('payment_succeeded', { email: 'a@acme.com' })
    ).resolves.toBeUndefined()
  })
})

describe('Cthru.trackServer() — error handling', () => {
  it('throws on non-2xx HTTP response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    await expect(
      makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    ).rejects.toThrow('401')
  })

  it('throws when the server marks the event as rejected', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ accepted: false, reason: 'future timestamp' }]),
    })
    await expect(
      makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    ).rejects.toThrow('future timestamp')
  })

  it('propagates network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(
      makeClient().trackServer('payment_succeeded', { userId: 'u1' })
    ).rejects.toThrow('ECONNREFUSED')
  })
})
