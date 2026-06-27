import { db } from './db'
import { validateTimestamp } from './validateTimestamp'
import { deriveAnonymousId } from './deriveAnonymousId'
import { classifyDomain } from './domainClassifier'
import type { RawEvent } from '@/types/events'

export async function processEvent(event: RawEvent): Promise<void> {
  const { suspect } = validateTimestamp(event.occurredAt, event.source)
  const anonymousId = deriveAnonymousId(event)
  const { companyDomain } = event.email
    ? await classifyDomain(event.email)
    : { companyDomain: null }

  // Critical write — if this fails the event is lost
  await db.query(
    `INSERT INTO events
       (name, source, anonymous_id, occurred_at, occurred_at_suspect, properties,
        user_id, email, company_domain, session_id, url, referrer, device)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      event.name,
      event.source,
      anonymousId,
      event.occurredAt,
      suspect,
      JSON.stringify(event.properties ?? {}),
      event.userId ?? null,
      event.email ?? null,
      companyDomain,
      event.sessionId ?? null,
      event.url ?? null,
      event.referrer ?? null,
      event.device ? JSON.stringify(event.device) : null,
    ]
  )

  // Best-effort derived upserts — failures are logged but never block the response
  await Promise.allSettled([
    upsertUser(event.userId, event.email),
    upsertCompany(companyDomain),
    upsertAlias(anonymousId, event.userId, event.email, companyDomain),
  ])
}

async function upsertUser(userId: string | undefined, email: string | undefined) {
  if (!userId) return
  await db.query(
    `INSERT INTO users (user_id, email, first_seen, last_seen)
     VALUES ($1, $2, now(), now())
     ON CONFLICT (user_id) DO UPDATE SET last_seen = now(), email = COALESCE(EXCLUDED.email, users.email)`,
    [userId, email ?? null]
  )
}

async function upsertCompany(companyDomain: string | null) {
  if (!companyDomain) return
  await db.query(
    `INSERT INTO companies (domain, first_seen, last_seen)
     VALUES ($1, now(), now())
     ON CONFLICT (domain) DO UPDATE SET last_seen = now()`,
    [companyDomain]
  )
}

async function upsertAlias(
  anonymousId: string,
  userId: string | undefined,
  email: string | undefined,
  companyDomain: string | null
) {
  if (!userId && !email) return
  await db.query(
    `INSERT INTO aliases (anonymous_id, user_id, email, company_domain, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (anonymous_id) DO UPDATE
       SET user_id = COALESCE(EXCLUDED.user_id, aliases.user_id),
           email = COALESCE(EXCLUDED.email, aliases.email),
           company_domain = EXCLUDED.company_domain,
           updated_at = now()`,
    [anonymousId, userId ?? null, email ?? null, companyDomain]
  )
}
