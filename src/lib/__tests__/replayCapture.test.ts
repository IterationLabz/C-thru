// @vitest-environment jsdom
/**
 * Issue 2 — Buffer-then-commit-on-identify (D-34, Stories 17–24, 27).
 *
 * CRITICAL TEST: a session where identify() never fires is DISCARDED client-side.
 * No fetch is called; nothing is transmitted; nothing is stored.
 *
 * These tests exercise the ReplayBuffer module directly. The identify() hook and
 * rrweb wiring are snippet concerns tested in snippet.test.ts; here we test the
 * buffer lifecycle in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReplayBuffer, BUFFER_MAX_EVENTS, BUFFER_MAX_DURATION_MS } from '../replay/buffer'

const TEST_CONFIG = {
  endpoint: '/api/ingest/replay',
  writeKey: 'test-write-key',
  sampleRate: 1.0, // record all sessions by default in tests
}

function makeBuffer(overrides = {}) {
  return new ReplayBuffer({ ...TEST_CONFIG, ...overrides })
}

function makeFetchMock() {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// CRITICAL: buffer discarded on no-identify (Stories 20, 17)
// ---------------------------------------------------------------------------

describe('D-34 — buffer discard: identify() never fires (CRITICAL)', () => {
  it('discard() does not call fetch — nothing transmitted', () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()

    buf.push({ type: 'fullSnapshot', data: {} })
    buf.push({ type: 'incrementalSnapshot', data: { source: 0 } })

    // Caller (visibilitychange / unload handler) calls discard() when
    // the tab closes without identify() having fired.
    buf.discard()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('discard() clears the buffer so a subsequent flush sends nothing', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()

    buf.push({ type: 'fullSnapshot', data: {} })
    buf.discard()

    const transmitted = await buf.flush('anon-1', 'user-1')
    expect(transmitted).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('size() returns 0 after discard', () => {
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })
    buf.discard()
    expect(buf.size()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Buffer: events are stored and flushed (Stories 18, 19)
// ---------------------------------------------------------------------------

describe('D-34 — buffer: events accumulate and flush on identify()', () => {
  it('push() stores events in the buffer', () => {
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot' })
    buf.push({ type: 'click' })
    expect(buf.size()).toBe(2)
  })

  it('flush() POSTs to the replay endpoint', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    await buf.flush('anon-abc', 'user-xyz')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/ingest/replay')
    expect(opts.method).toBe('POST')
  })

  it('flush() sends X-Write-Key header', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    await buf.flush('anon-abc', 'user-xyz')

    const opts = fetchMock.mock.calls[0]![1]
    expect(opts.headers['X-Write-Key']).toBe('test-write-key')
  })

  it('flush() sends X-Anonymous-Id and X-User-Id headers', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    await buf.flush('anon-abc', 'user-xyz')

    const opts = fetchMock.mock.calls[0]![1]
    expect(opts.headers['X-Anonymous-Id']).toBe('anon-abc')
    expect(opts.headers['X-User-Id']).toBe('user-xyz')
  })

  it('flush() sends Content-Type: application/octet-stream (compressed binary)', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    await buf.flush('anon-abc', 'user-xyz')

    const opts = fetchMock.mock.calls[0]![1]
    expect(opts.headers['Content-Type']).toBe('application/octet-stream')
  })

  it('flush() sends a Uint8Array body (client-side gzip compressed — Story 27)', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    await buf.flush('anon-abc', 'user-xyz')

    const opts = fetchMock.mock.calls[0]![1]
    expect(opts.body).toBeInstanceOf(Uint8Array)
  })

  it('flush() clears the buffer after transmission', async () => {
    makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })
    buf.push({ type: 'click', data: {} })

    await buf.flush('anon-a', 'user-a')
    expect(buf.size()).toBe(0)
  })

  it('flush() returns true when events were transmitted', async () => {
    makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    const result = await buf.flush('anon-a', 'user-a')
    expect(result).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Buffer cap: oldest events evicted (Story 21)
// ---------------------------------------------------------------------------

describe('D-34 — buffer cap: oldest events evicted at max size (Story 21)', () => {
  it('evicts the oldest event when the event count cap is reached', () => {
    const buf = makeBuffer({ maxEvents: 3 })
    buf.push({ type: 'a', seq: 1 })
    buf.push({ type: 'b', seq: 2 })
    buf.push({ type: 'c', seq: 3 })
    buf.push({ type: 'd', seq: 4 }) // should evict seq:1

    expect(buf.size()).toBe(3)
    const entries = buf._entries()
    expect(entries.some(e => (e.event as any).seq === 1)).toBe(false)
    expect(entries.some(e => (e.event as any).seq === 4)).toBe(true)
  })

  it('evicts multiple oldest events when pushing past the cap', () => {
    const buf = makeBuffer({ maxEvents: 2 })
    buf.push({ seq: 1 })
    buf.push({ seq: 2 })
    buf.push({ seq: 3 })
    buf.push({ seq: 4 })

    const entries = buf._entries()
    const seqs = entries.map(e => (e.event as any).seq)
    expect(seqs).toEqual([3, 4])
  })

  it('exports BUFFER_MAX_EVENTS constant', () => {
    expect(BUFFER_MAX_EVENTS).toBeGreaterThan(0)
  })

  it('exports BUFFER_MAX_DURATION_MS constant', () => {
    expect(BUFFER_MAX_DURATION_MS).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Sampling: per-session atomic decision at flush time (Stories 23, 24)
// ---------------------------------------------------------------------------

describe('D-34 — sampling: per-session decision at flush time (Stories 23, 24)', () => {
  it('samples out when random() > sampleRate — no fetch called', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer({
      sampleRate: 0.5,
      _random: () => 0.9, // always above sampleRate → sampled out
    })

    buf.push({ type: 'fullSnapshot', data: {} })
    const transmitted = await buf.flush('anon-a', 'user-a')

    expect(transmitted).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('records when random() <= sampleRate — fetch called', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer({
      sampleRate: 0.5,
      _random: () => 0.3, // below sampleRate → recorded
    })

    buf.push({ type: 'fullSnapshot', data: {} })
    const transmitted = await buf.flush('anon-a', 'user-a')

    expect(transmitted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sampleRate=0 never records', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer({ sampleRate: 0 })

    buf.push({ type: 'fullSnapshot', data: {} })
    await buf.flush('anon-a', 'user-a')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sampleRate=1 always records', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer({ sampleRate: 1 })

    buf.push({ type: 'fullSnapshot', data: {} })
    await buf.flush('anon-a', 'user-a')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('discard() is called on sample-out — buffer cleared without transmission', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer({ sampleRate: 0, _random: () => 0.5 })
    buf.push({ type: 'fullSnapshot', data: {} })

    await buf.flush('anon-a', 'user-a')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(buf.size()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Anonymous sessions: userId required for transmission (Story 17)
// ---------------------------------------------------------------------------

describe('D-34 — anonymous sessions never transmitted', () => {
  it('flush() with empty userId does not call fetch', async () => {
    const fetchMock = makeFetchMock()
    const buf = makeBuffer()
    buf.push({ type: 'fullSnapshot', data: {} })

    // No userId = anonymous-only session; caller should pass empty string
    // when userId is not known. The endpoint also enforces this server-side.
    const transmitted = await buf.flush('anon-abc', '')
    expect(transmitted).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
