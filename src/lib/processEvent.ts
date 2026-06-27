import { db } from './db'
import type { RawEvent } from '@/types/events'

export async function processEvent(event: RawEvent): Promise<void> {
  await db.query(
    `INSERT INTO events
       (name, source, anonymous_id, occurred_at, properties,
        user_id, email, session_id, url, referrer, device)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      event.name,
      event.source,
      event.anonymousId,
      event.occurredAt,
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
