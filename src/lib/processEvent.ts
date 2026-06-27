import { db } from './db'
import { validateTimestamp } from './validateTimestamp'
import { deriveAnonymousId } from './deriveAnonymousId'
import type { RawEvent } from '@/types/events'

export async function processEvent(event: RawEvent): Promise<void> {
  const { suspect } = validateTimestamp(event.occurredAt, event.source)
  const anonymousId = deriveAnonymousId(event)

  await db.query(
    `INSERT INTO events
       (name, source, anonymous_id, occurred_at, occurred_at_suspect, properties,
        user_id, email, session_id, url, referrer, device)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      event.name,
      event.source,
      anonymousId,
      event.occurredAt,
      suspect,
      JSON.stringify(event.properties ?? {}),
      event.userId ?? null,
      event.email ?? null,
      event.sessionId ?? null,
      event.url ?? null,
      event.referrer ?? null,
      event.device ? JSON.stringify(event.device) : null,
    ]
  )
}
