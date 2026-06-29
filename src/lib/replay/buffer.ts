// Buffer-then-commit-on-identify model (D-34).
//
// rrweb events are buffered from session start (masking applied before they
// enter the buffer — D-32 guarantees this because masking is configured at
// recorder initialisation, before any event is emitted).
//
// When cthru.identify() fires:
//   1. Sampling decision made once per session (atomic, per-session).
//   2. If outside sample rate: buffer discarded, nothing transmitted.
//   3. If within sample rate: buffer is gzip-compressed client-side and POSTed
//      to /api/ingest/replay. The real value never exists uncompressed on the wire.
//
// If identify() never fires before tab-close / unload: discard() is called by
// the caller (e.g. visibilitychange handler) — nothing is transmitted, nothing
// is stored.

import { gzipSync } from 'fflate'

export const BUFFER_MAX_EVENTS = 500
export const BUFFER_MAX_DURATION_MS = 5 * 60 * 1000 // 5 minutes

export interface ReplayBufferConfig {
  endpoint: string
  writeKey: string
  sampleRate: number // 0–1; 1.0 = record all, 0.5 = record 50%
  maxEvents?: number
  maxDurationMs?: number
  // Injected for deterministic tests; defaults to Math.random()
  _random?: () => number
}

interface BufferEntry {
  event: unknown
  timestamp: number
}

export class ReplayBuffer {
  private entries: BufferEntry[] = []
  private readonly startedAt: number
  private readonly maxEvents: number
  private readonly maxDurationMs: number
  private readonly random: () => number

  constructor(private config: ReplayBufferConfig) {
    this.startedAt = Date.now()
    this.maxEvents = config.maxEvents ?? BUFFER_MAX_EVENTS
    this.maxDurationMs = config.maxDurationMs ?? BUFFER_MAX_DURATION_MS
    this.random = config._random ?? Math.random.bind(Math)
  }

  // push() is called by the rrweb emit callback.
  // Masking is already applied by rrweb before this runs (D-32 guarantee).
  push(event: unknown): void {
    const now = Date.now()

    // Evict events outside the duration window first (oldest first)
    const cutoff = now - this.maxDurationMs
    while (this.entries.length > 0 && this.entries[0]!.timestamp < cutoff) {
      this.entries.shift()
    }

    // Evict oldest events if at the event count cap
    while (this.entries.length >= this.maxEvents) {
      this.entries.shift()
    }

    this.entries.push({ event, timestamp: now })
  }

  // flush() is called when cthru.identify() fires.
  // Makes the per-session sampling decision, compresses, and POSTs.
  // Returns true if the session was transmitted, false if sampled out or no userId.
  async flush(anonymousId: string, userId: string): Promise<boolean> {
    // Anonymous-only sessions are never stored (D-34).
    if (!userId || this.entries.length === 0) {
      return false
    }

    // Per-session sampling decision: atomic at flush time.
    if (this.random() > this.config.sampleRate) {
      this.discard()
      return false
    }

    const events = this.entries.map(e => e.event)
    const json = JSON.stringify(events)
    // Client-side gzip compression before transmission (D-33 / Story 27).
    // The wire payload is masked + compressed; real values never travel in plaintext.
    const compressed = gzipSync(new TextEncoder().encode(json))

    await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Write-Key': this.config.writeKey,
        'X-Anonymous-Id': anonymousId,
        'X-User-Id': userId,
        'X-Started-At': new Date(this.startedAt).toISOString(),
      },
      body: compressed,
    })

    this.discard()
    return true
  }

  // discard() is called on tab-close/unload if identify() never fired,
  // or after a sampling-out at flush time.
  // Nothing is transmitted; the browser buffer is cleared.
  discard(): void {
    this.entries = []
  }

  size(): number {
    return this.entries.length
  }

  // Exposed for tests to inspect entries without flushing.
  _entries(): readonly BufferEntry[] {
    return this.entries
  }
}
