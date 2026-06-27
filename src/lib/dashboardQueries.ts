import { db } from './db'

export interface ActiveUsers {
  last7: number
  last30: number
}

export interface NewSignups {
  last7: number
  last30: number
}

export interface TopEvent {
  name: string
  count: number
}

export async function getActiveUsers(): Promise<ActiveUsers> {
  const { rows } = await db.query<{ last7: string; last30: string }>(`
    SELECT
      COUNT(DISTINCT CASE WHEN e.occurred_at_effective >= NOW() - INTERVAL '7 days'  THEN a.user_id END) AS last7,
      COUNT(DISTINCT CASE WHEN e.occurred_at_effective >= NOW() - INTERVAL '30 days' THEN a.user_id END) AS last30
    FROM events_v e
    JOIN aliases a ON e.anonymous_id = a.anonymous_id
    WHERE a.user_id IS NOT NULL
  `)
  const row = rows[0]
  return {
    last7: parseInt(row.last7, 10),
    last30: parseInt(row.last30, 10),
  }
}

export async function getNewSignups(): Promise<NewSignups> {
  const { rows } = await db.query<{ last7: string; last30: string }>(`
    SELECT
      COUNT(*) FILTER (WHERE first_seen >= NOW() - INTERVAL '7 days')  AS last7,
      COUNT(*) FILTER (WHERE first_seen >= NOW() - INTERVAL '30 days') AS last30
    FROM users
  `)
  const row = rows[0]
  return {
    last7: parseInt(row.last7, 10),
    last30: parseInt(row.last30, 10),
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

export async function getLiveCount(): Promise<number> {
  const { rows } = await db.query<{ count: string }>(`
    SELECT COUNT(*) AS count
    FROM events
    WHERE received_at >= NOW() - INTERVAL '60 seconds'
  `)
  return parseInt(rows[0].count, 10)
}
