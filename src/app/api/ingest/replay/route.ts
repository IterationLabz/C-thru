import { NextRequest, NextResponse } from 'next/server'
import { writeSession } from '@/lib/replay/storage'
import { getReplaySettings } from '@/lib/replay/consentGate'

// POST /api/ingest/replay — receives gzip-compressed recording payload from
// the snippet buffer. Validates write key + userId, then stores as chunks.
// Anonymous-only sessions (no userId) are rejected — discarded client-side
// before reaching here, but the server enforces it too (D-34).
// Replay disabled (D-37): gate check — reject if replay_settings.enabled=false.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const writeKey = req.headers.get('x-write-key')
  if (!writeKey || writeKey !== process.env.CTHRU_WRITE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Consent gate (D-37): replay is off by default; reject when disabled.
  const settings = await getReplaySettings()
  if (!settings.enabled) {
    return NextResponse.json({ error: 'replay_disabled' }, { status: 403 })
  }

  const anonymousId = req.headers.get('x-anonymous-id') ?? ''
  const userId = req.headers.get('x-user-id') ?? ''
  const startedAtHeader = req.headers.get('x-started-at')

  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  const startedAt = startedAtHeader ? new Date(startedAtHeader) : new Date()

  // Body is a single gzip-compressed chunk (the buffer flush payload).
  // We store it as chunk seq=1. Multi-chunk uploads are a future enhancement.
  const body = await req.arrayBuffer()
  const chunk = new Uint8Array(body)

  const session = await writeSession({
    anonymousId,
    userId,
    startedAt,
    chunks: chunk.length > 0 ? [chunk] : [],
  })

  return NextResponse.json({ accepted: true, sessionId: session.sessionId })
}
