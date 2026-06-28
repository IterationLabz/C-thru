import { db } from './db'

const ALLOWED_VIEWS = ['signups_v', 'active_users_v', 'company_activity_v', 'events_v'] as const

const VIEW_DESCRIPTIONS: Record<string, string> = {
  signups_v:
    'one row per identified user; company_domain is NULL for personal emails (gmail etc)',
  active_users_v:
    'identified users with at least one event; multi-device collapsed by user_id',
  company_activity_v:
    'one row per company domain; pre-login events attributed retroactively; personal emails excluded',
  events_v:
    'raw event stream — prefer the semantic views above for most questions',
}

const COLUMN_NOTES: Record<string, string> = {
  'signups_v.signed_up_at':              'when the user was first seen',
  'signups_v.company_domain':            'NULL for personal emails',
  'active_users_v.last_event_at':        'most recent received_at — use for recency/trends',
  'active_users_v.company_domain':       'NULL for personal emails',
  'active_users_v.total_events':         'lifetime event count',
  'company_activity_v.domain':           'company domain (personal emails excluded)',
  'company_activity_v.identified_users': 'users who have logged in (anonymous-only excluded)',
  'company_activity_v.last_event_at':    'most recent received_at',
  'events_v.received_at':                'server receipt time — use this for recency and trends',
  'events_v.occurred_at_effective':      'client-reported time — use for user-perceived timing',
  'events_v.user_id':                    'NULL for pre-login (anonymous) events',
  'events_v.company_domain':             'NULL until the user is identified',
  'events_v.name':                       'event name, e.g. pageview, signup_completed',
}

type ColRow = { table_name: string; column_name: string; data_type: string }

export async function getSchemaContext(): Promise<string> {
  const { rows } = await db.query<ColRow>(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [ALLOWED_VIEWS])

  const byView: Record<string, ColRow[]> = {}
  for (const row of rows) {
    ;(byView[row.table_name] ??= []).push(row)
  }

  const parts: string[] = []
  for (const view of ALLOWED_VIEWS) {
    const cols = byView[view] ?? []
    const desc = VIEW_DESCRIPTIONS[view] ?? ''
    const colLines = cols.map(c => {
      const note = COLUMN_NOTES[`${view}.${c.column_name}`]
      const type = c.data_type.toUpperCase().replace('CHARACTER VARYING', 'TEXT')
      return note
        ? `  ${c.column_name} ${type}, -- ${note}`
        : `  ${c.column_name} ${type},`
    })
    parts.push(`-- ${view}: ${desc}\nVIEW ${view} (\n${colLines.join('\n')}\n);`)
  }

  return parts.join('\n\n')
}
