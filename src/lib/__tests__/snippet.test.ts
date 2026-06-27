// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const snippetCode = readFileSync(join(process.cwd(), 'public/cthru.js'), 'utf-8')

function loadSnippet() {
  // Inject config before eval — simulates data-* attrs for tests
  ;(window as any).CthruConfig = { writeKey: 'test-write-key', host: '' }
  eval(snippetCode)
}

// Let async work from fetch promises settle
const tick = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  delete (window as any).cthru
  delete (window as any).CthruConfig
  localStorage.clear()
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ accepted: true }]),
  })
  loadSnippet()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cthru snippet — public API', () => {
  it('exposes window.cthru with track and identify', () => {
    expect(typeof (window as any).cthru.track).toBe('function')
    expect(typeof (window as any).cthru.identify).toBe('function')
  })
})

describe('cthru snippet — anonymous_id', () => {
  it('creates an anonymous_id in localStorage on load', () => {
    const id = localStorage.getItem('cthru_anon_id')
    expect(id).toBeTruthy()
  })

  it('reuses the same anonymous_id across calls', () => {
    const id1 = localStorage.getItem('cthru_anon_id')
    ;(window as any).cthru.track('test', {})
    const id2 = localStorage.getItem('cthru_anon_id')
    expect(id1).toBe(id2)
  })

  it('does not overwrite an existing anonymous_id', () => {
    localStorage.setItem('cthru_anon_id', 'existing-id')
    delete (window as any).cthru
    loadSnippet()
    expect(localStorage.getItem('cthru_anon_id')).toBe('existing-id')
  })
})

describe('cthru snippet — track()', () => {
  it('calls fetch with the event name and source: custom', async () => {
    ;(window as any).cthru.track('invited_teammate', { count: 3 })
    await tick()
    expect(global.fetch).toHaveBeenCalled()
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
    const event = body.events.find((e: any) => e.name === 'invited_teammate')
    expect(event).toBeDefined()
    expect(event.source).toBe('custom')
    expect(event.properties).toMatchObject({ count: 3 })
  })

  it('includes the anonymous_id in every event', async () => {
    ;(window as any).cthru.track('pageview', {})
    await tick()
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
    expect(body.events[0].anonymousId).toBeTruthy()
  })

  it('includes the writeKey in the request body', async () => {
    ;(window as any).cthru.track('pageview', {})
    await tick()
    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
    expect(body.writeKey).toBe('test-write-key')
  })
})

describe('cthru snippet — identify()', () => {
  it('attaches userId to subsequent track events', async () => {
    ;(window as any).cthru.identify('user-123', { email: 'a@acme.com' })
    ;(window as any).cthru.track('hit_paywall', {})
    await tick()
    const calls = (global.fetch as any).mock.calls
    const lastBody = JSON.parse(calls[calls.length - 1][1].body)
    const event = lastBody.events.find((e: any) => e.name === 'hit_paywall')
    expect(event.userId).toBe('user-123')
  })

  it('attaches email to subsequent track events', async () => {
    ;(window as any).cthru.identify('user-456', { email: 'b@stripe.com' })
    ;(window as any).cthru.track('pageview', {})
    await tick()
    const calls = (global.fetch as any).mock.calls
    const lastBody = JSON.parse(calls[calls.length - 1][1].body)
    const event = lastBody.events.find((e: any) => e.name === 'pageview')
    expect(event.email).toBe('b@stripe.com')
  })
})

describe('cthru snippet — retry on rejection', () => {
  it('re-queues and retries a rejected event on the next flush', async () => {
    // First batch has [session_start, payment_succeeded] — accept session_start, reject payment_succeeded
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ accepted: true }, { accepted: false }]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{ accepted: true }, { accepted: true }]) })

    ;(window as any).cthru.track('payment_succeeded', {})
    await tick() // fetch resolves
    await tick() // .then(res.json) resolves
    await tick() // .then(retry) runs — payment_succeeded back in queue

    // Trigger another event — flush sends [payment_succeeded, next_event]
    ;(window as any).cthru.track('next_event', {})
    await tick()

    expect(global.fetch).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse((global.fetch as any).mock.calls[1][1].body)
    expect(secondBody.events.some((e: any) => e.name === 'payment_succeeded')).toBe(true)
  })
})
