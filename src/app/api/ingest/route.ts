import { NextRequest, NextResponse } from 'next/server'
import { processEvent } from '@/lib/processEvent'
import { isRateLimited } from '@/lib/rateLimit'
import type { RawEvent } from '@/types/events'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    writeKey?: string
    serverKey?: string
    events: RawEvent[]
  }

  const { writeKey, serverKey, events } = body

  // Reject if no key provided
  if (!writeKey && !serverKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  // Validate writeKey
  if (writeKey && writeKey !== process.env.CTHRU_WRITE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  // Validate serverKey
  if (serverKey && serverKey !== process.env.CTHRU_SERVER_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  // Rate limit by key — 429 if exceeded
  const rateLimitKey = writeKey ?? serverKey!
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': '60' } }
    )
  }

  // writeKey cannot submit server events — that channel requires serverKey
  if (writeKey) {
    const hasServerEvent = events.some(e => e.source === 'server')
    if (hasServerEvent) {
      return NextResponse.json(
        { error: 'Forbidden: server events require serverKey' },
        { status: 403, headers: CORS_HEADERS }
      )
    }
  }

  // Process each event and collect per-event results
  const results: Array<{ accepted: boolean; reason?: string }> = []

  for (const event of events) {
    try {
      await processEvent(event)
      results.push({ accepted: true })
    } catch {
      results.push({ accepted: false, reason: 'internal error' })
    }
  }

  return NextResponse.json(results, { headers: CORS_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
