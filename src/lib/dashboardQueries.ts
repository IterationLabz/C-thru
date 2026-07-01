import { db } from './db'

export interface ActiveUsers {
  last7: number
  last30: number
  prior7: number  // the 7 days before last7 — used to compute a real trend, never invented
}

export interface NewSignups {
  last7: number
  last30: number
  prior7: number  // the 7 days before last7 — used to compute a real trend, never invented
}

export interface TopEvent {
  name: string
  count: number
}

export async function getActiveUsers(): Promise<ActiveUsers> {
  const { rows } = await db.query<{ last7: string; last30: string; prior7: string }>(`
    SELECT
      COUNT(DISTINCT CASE WHEN e.occurred_at_effective >= NOW() - INTERVAL '7 days'  THEN a.user_id END) AS last7,
      COUNT(DISTINCT CASE WHEN e.occurred_at_effective >= NOW() - INTERVAL '30 days' THEN a.user_id END) AS last30,
      COUNT(DISTINCT CASE WHEN e.occurred_at_effective >= NOW() - INTERVAL '14 days'
                       AND  e.occurred_at_effective <  NOW() - INTERVAL '7 days'  THEN a.user_id END) AS prior7
    FROM events_v e
    JOIN aliases a ON e.anonymous_id = a.anonymous_id
    WHERE a.user_id IS NOT NULL
  `)
  const row = rows[0] ?? { last7: '0', last30: '0', prior7: '0' }
  return {
    last7: parseInt(row.last7, 10),
    last30: parseInt(row.last30, 10),
    prior7: parseInt(row.prior7, 10),
  }
}

export async function getNewSignups(): Promise<NewSignups> {
  const { rows } = await db.query<{ last7: string; last30: string; prior7: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE first_seen >= NOW() - INTERVAL '7 days')  AS last7,
      COUNT(*) FILTER (WHERE first_seen >= NOW() - INTERVAL '30 days') AS last30,
      COUNT(*) FILTER (WHERE first_seen >= NOW() - INTERVAL '14 days'
                        AND first_seen <  NOW() - INTERVAL '7 days')   AS prior7
    FROM users
  `)
  const row = rows[0] ?? { last7: '0', last30: '0', prior7: '0' }
  return {
    last7: parseInt(row.last7, 10),
    last30: parseInt(row.last30, 10),
    prior7: parseInt(row.prior7, 10),
  }
}

export async function getTopEvents(): Promise<TopEvent[]> {
  const { rows } = await db.query<{ name: string; count: string }>(`
    SELECT name, COUNT(*) AS count
    FROM events_v
    GROUP BY name
    ORDER BY count DESC
    LIMIT 10
  `)
  return rows.map(r => ({ name: r.name, count: parseInt(r.count, 10) }))
}

export interface TopCompany {
  domain: string
  eventCount: number       // events in the last 7 days — matches the "Events · 7d" column label
  lastEventAt: string | null
}

export async function getTopCompanies(): Promise<TopCompany[]> {
  const { rows } = await db.query<{ domain: string; event_count: string; last_event_at: string | null }>(`
    SELECT company_domain AS domain, COUNT(*) AS event_count, MAX(received_at) AS last_event_at
    FROM events_v
    WHERE company_domain IS NOT NULL
      AND received_at >= NOW() - INTERVAL '7 days'
    GROUP BY company_domain
    ORDER BY event_count DESC
    LIMIT 25
  `)
  return rows.map(r => ({
    domain: r.domain,
    eventCount: parseInt(r.event_count, 10),
    lastEventAt: r.last_event_at,
  }))
}

export interface EventsOverTimePoint {
  date: string   // YYYY-MM-DD
  count: number
}

// getEventsOverTime — events per day for the last `days` days (inclusive of today).
// Zero-event days are filled in via generate_series so the chart never silently
// skips a day.
export async function getEventsOverTime(days = 14): Promise<EventsOverTimePoint[]> {
  const { rows } = await db.query<{ date: string; count: string }>(
    `
    SELECT to_char(gs.day, 'YYYY-MM-DD') AS date, COUNT(e.id) AS count
    FROM generate_series((CURRENT_DATE - ($1::int - 1)), CURRENT_DATE, INTERVAL '1 day') AS gs(day)
    LEFT JOIN events_v e ON e.occurred_at_effective::date = gs.day
    GROUP BY gs.day
    ORDER BY gs.day
    `,
    [days]
  )
  return rows.map(r => ({ date: r.date, count: parseInt(r.count, 10) }))
}

export interface ActiveUsersOverTimePoint {
  date: string   // YYYY-MM-DD
  count: number
}

// getActiveUsersOverTime — distinct identified users active per day for the last
// `days` days. "Active" = at least one event received that day (same recency
// signal as active_users_v). Zero-user days are filled in via generate_series.
export async function getActiveUsersOverTime(days = 14): Promise<ActiveUsersOverTimePoint[]> {
  const { rows } = await db.query<{ date: string; count: string }>(
    `
    SELECT to_char(gs.day, 'YYYY-MM-DD') AS date, COUNT(DISTINCT a.user_id) AS count
    FROM generate_series((CURRENT_DATE - ($1::int - 1)), CURRENT_DATE, INTERVAL '1 day') AS gs(day)
    LEFT JOIN events_v e ON e.received_at::date = gs.day
    LEFT JOIN aliases a ON a.anonymous_id = e.anonymous_id AND a.user_id IS NOT NULL
    GROUP BY gs.day
    ORDER BY gs.day
    `,
    [days]
  )
  return rows.map(r => ({ date: r.date, count: parseInt(r.count, 10) }))
}

export function formatDomain(domain: string): string {
  const sld = domain.split('.')[0] ?? domain
  return sld.charAt(0).toUpperCase() + sld.slice(1)
}

export async function getLiveCount(): Promise<number> {
  const { rows } = await db.query<{ count: string }>(`
    SELECT COUNT(*) AS count
    FROM events
    WHERE received_at >= NOW() - INTERVAL '60 seconds'
  `)
  return parseInt(rows[0]?.count ?? '0', 10)
}
