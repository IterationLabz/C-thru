import { NextRequest, NextResponse } from 'next/server'

// Stub endpoint for Issue 2 (capture scope).
// Accepts the gzip-compressed recording payload from the snippet buffer,
// validates the write key, and returns 200.
// Real storage (writeSession + chunks) is wired in Issue 3.

export async function POST(req: NextRequest): Promise<NextResponse> {
  const writeKey = req.headers.get('x-write-key')
  if (!writeKey || writeKey !== process.env.CTHRU_WRITE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const anonymousId = req.headers.get('x-anonymous-id')
  const userId = req.headers.get('x-user-id')

  // Anonymous-only sessions must never be stored (D-34).
  if (!userId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 })
  }

  // Body is gzip-compressed BYTEA — consume but do not store yet (Issue 3).
  await req.arrayBuffer()

  return NextResponse.json({ accepted: true, anonymousId, userId })
}
