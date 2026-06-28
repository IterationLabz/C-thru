import { db } from './db'

export interface JourneyEvent {
  id: number
  name: string
  receivedAt: string
  anonymousId: string
  postIdentification: boolean  // first_identified_at <= received_at (D-23/D-24)
}

export interface JourneyUser {
  userId: string
  email: string | null
  firstIdentifiedAt: string | null  // null if user has never identified
}

export interface Journey {
  user: JourneyUser
  events: JourneyEvent[]
  identificationAt: string | null  // earliest first_identified_at across all aliases
}

// getJourney — full event timeline for a user.
// Includes pre-login events via alias join (D-23).
// post_identification is derived from first_identified_at <= received_at, NOT
// from alias.user_id presence at event time (D-23 seam, D-24 invariant).
export async function getJourney(userId: string): Promise<Journey | null> {
  const { rows: userRows } = await db.query<{ email: string | null }>(
    `SELECT email FROM users WHERE user_id = $1`,
    [userId]
  )
  if (userRows.length === 0) return null

  // Canonical identification time: earliest first_identified_at across all aliases.
  const { rows: identRows } = await db.query<{ identified_at: string | null }>(
    `SELECT MIN(first_identified_at)::text AS identified_at
     FROM aliases
     WHERE user_id = $1`,
    [userId]
  )
  const identificationAt = identRows[0]?.identified_at ?? null

  const { rows: eventRows } = await db.query<{
    id: number
    name: string
    received_at: string
    anonymous_id: string
    post_identification: boolean
  }>(
    `SELECT
       e.id,
       e.name,
       e.received_at::text,
       e.anonymous_id,
       CASE
         WHEN $2::timestamptz IS NOT NULL
           AND $2::timestamptz <= e.received_at THEN true
         ELSE false
       END AS post_identification
     FROM events_v e
     JOIN aliases a ON e.anonymous_id = a.anonymous_id
     WHERE a.user_id = $1
     ORDER BY e.received_at ASC`,
    [userId, identificationAt]
  )

  return {
    user: { userId, email: userRows[0]!.email ?? null, firstIdentifiedAt: identificationAt },
    events: eventRows.map(r => ({
      id: r.id,
      name: r.name,
      receivedAt: r.received_at,
      anonymousId: r.anonymous_id,
      postIdentification: r.post_identification,
    })),
    identificationAt,
  }
}

// listUsersForJourney — users with event counts, for navigation.
export async function listUsersForJourney(limit = 50): Promise<
  Array<{ userId: string; email: string | null; eventCount: number; lastEventAt: string }>
> {
  const { rows } = await db.query<{
    user_id: string; email: string | null; event_count: string; last_event_at: string
  }>(
    `SELECT user_id, email, total_events::text AS event_count, last_event_at::text
     FROM active_users_v
     ORDER BY last_event_at DESC
     LIMIT $1`,
    [limit]
  )
  return rows.map(r => ({
    userId: r.user_id,
    email: r.email,
    eventCount: Number(r.event_count),
    lastEventAt: r.last_event_at,
  }))
}
