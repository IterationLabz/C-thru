import { createHash } from 'crypto'
import type { RawEvent } from '@/types/events'

export function deriveAnonymousId(event: RawEvent): string {
  if (event.anonymousId) return event.anonymousId

  if (event.source === 'server') {
    if (event.userId) return event.userId
    if (event.email) return createHash('sha256').update(event.email.toLowerCase()).digest('hex')
    throw new Error('server events require userId or email to derive anonymous_id')
  }

  throw new Error('browser events require anonymousId')
}
