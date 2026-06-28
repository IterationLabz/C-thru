import { db } from './db'

export interface SavedFunnel {
  id: number
  name: string
  mode: 'user' | 'company'
  windowDays: number
  steps: FunnelStep[]
  createdAt: string
}

export interface FunnelStep {
  eventName: string
}

export interface FunnelInput {
  steps: FunnelStep[]
  mode: 'user' | 'company'
  windowDays?: number
}

export interface FunnelStepResult {
  eventName: string
  count: number
  dropoffPct: number  // percentage drop from previous step; 0 for step 1
}

export interface FunnelResult {
  steps: FunnelStepResult[]
  mode: 'user' | 'company'
}

export interface ValidationResult {
  valid: boolean
  unknownEvents: string[]
}

// validateFunnelSteps — single batched ANY() query to find unknown event names.
// Returns valid=true and empty array if all names have been fired at least once.
export async function validateFunnelSteps(eventNames: string[]): Promise<ValidationResult> {
  if (eventNames.length === 0) return { valid: true, unknownEvents: [] }
  const { rows } = await db.query<{ name: string }>(
    `SELECT DISTINCT name FROM events_v WHERE name = ANY($1::text[])`,
    [eventNames]
  )
  const known = new Set(rows.map(r => r.name))
  const unknownEvents = eventNames.filter(n => !known.has(n))
  return { valid: unknownEvents.length === 0, unknownEvents }
}

// evaluateFunnel — parameterized CTE chain.
// Event names are passed as $1..$N bind params — never interpolated into the query string.
// Each CTE step is the intersection of entities that completed all prior steps.
// user mode: tracks distinct user_ids (via alias join).
// company mode: tracks distinct company_domains (via alias + users).
export async function evaluateFunnel(input: FunnelInput): Promise<FunnelResult> {
  const { steps, mode, windowDays = 30 } = input

  if (steps.length === 0) {
    return { steps: [], mode }
  }

  // Build params: first N entries are event names, last entry is windowDays
  const params: (string | number)[] = steps.map(s => s.eventName)
  const winIdx = params.push(windowDays)  // $winIdx

  const windowExpr = `NOW() - ($${winIdx} || ' days')::INTERVAL`

  const ctes: string[] = []
  const selects: string[] = []

  if (mode === 'user') {
    // step_1: users who fired event $1 in the window
    ctes.push(`step_1 AS (
      SELECT DISTINCT a.user_id
      FROM events_v e
      JOIN aliases a ON e.anonymous_id = a.anonymous_id
      WHERE e.name = $1
        AND a.user_id IS NOT NULL
        AND e.received_at >= ${windowExpr}
    )`)
    selects.push(`(SELECT COUNT(*) FROM step_1)::int AS s1`)

    // step_2..N: users who fired event $N AND appear in the prior step
    for (let i = 1; i < steps.length; i++) {
      const stepNum = i + 1
      const prevStep = `step_${stepNum - 1}`
      ctes.push(`step_${stepNum} AS (
        SELECT DISTINCT a.user_id
        FROM events_v e
        JOIN aliases a ON e.anonymous_id = a.anonymous_id
        JOIN ${prevStep} prev ON a.user_id = prev.user_id
        WHERE e.name = $${stepNum}
          AND e.received_at >= ${windowExpr}
      )`)
      selects.push(`(SELECT COUNT(*) FROM step_${stepNum})::int AS s${stepNum}`)
    }
  } else {
    // company mode: track company_domain instead of user_id
    ctes.push(`step_1 AS (
      SELECT DISTINCT
        CASE
          WHEN u.email LIKE '%@%' THEN lower(split_part(u.email, '@', 2))
          ELSE NULL
        END AS company_domain
      FROM events_v e
      JOIN aliases a ON e.anonymous_id = a.anonymous_id
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE e.name = $1
        AND a.user_id IS NOT NULL
        AND e.received_at >= ${windowExpr}
        AND u.email LIKE '%@%'
    )`)
    selects.push(`(SELECT COUNT(*) FROM step_1 WHERE company_domain IS NOT NULL)::int AS s1`)

    for (let i = 1; i < steps.length; i++) {
      const stepNum = i + 1
      const prevStep = `step_${stepNum - 1}`
      ctes.push(`step_${stepNum} AS (
        SELECT DISTINCT
          CASE
            WHEN u.email LIKE '%@%' THEN lower(split_part(u.email, '@', 2))
            ELSE NULL
          END AS company_domain
        FROM events_v e
        JOIN aliases a ON e.anonymous_id = a.anonymous_id
        LEFT JOIN users u ON a.user_id = u.user_id
        JOIN ${prevStep} prev ON lower(split_part(u.email, '@', 2)) = prev.company_domain
        WHERE e.name = $${stepNum}
          AND e.received_at >= ${windowExpr}
          AND u.email LIKE '%@%'
      )`)
      selects.push(`(SELECT COUNT(*) FROM step_${stepNum} WHERE company_domain IS NOT NULL)::int AS s${stepNum}`)
    }
  }

  const sql = `WITH ${ctes.join(',\n')} SELECT ${selects.join(', ')}`
  const { rows } = await db.query<Record<string, number>>(sql, params)
  const row = rows[0] ?? {}

  const stepResults: FunnelStepResult[] = steps.map((step, i) => {
    const count = Number(row[`s${i + 1}`] ?? 0)
    const prevCount = i === 0 ? count : Number(row[`s${i}`] ?? 0)
    const dropoffPct = i === 0 || prevCount === 0 ? 0 : Math.round((1 - count / prevCount) * 100)
    return { eventName: step.eventName, count, dropoffPct }
  })

  return { steps: stepResults, mode }
}

// saveFunnel — persist a named funnel definition (steps by position).
export async function saveFunnel(
  name: string,
  mode: 'user' | 'company',
  windowDays: number,
  steps: FunnelStep[]
): Promise<SavedFunnel> {
  const { rows } = await db.query<{ id: number; created_at: string }>(
    `INSERT INTO funnels (name, mode, window_days) VALUES ($1, $2, $3) RETURNING id, created_at`,
    [name, mode, windowDays]
  )
  const { id, created_at } = rows[0]!
  for (let i = 0; i < steps.length; i++) {
    await db.query(
      `INSERT INTO funnel_steps (funnel_id, position, event_name) VALUES ($1, $2, $3)`,
      [id, i, steps[i]!.eventName]
    )
  }
  return { id, name, mode, windowDays, steps, createdAt: created_at }
}

// listFunnels — fetch all saved funnels with their ordered steps.
export async function listFunnels(): Promise<SavedFunnel[]> {
  const { rows: funnelRows } = await db.query<{
    id: number; name: string; mode: string; window_days: number; created_at: string
  }>(`SELECT id, name, mode, window_days, created_at FROM funnels ORDER BY created_at DESC`)

  if (funnelRows.length === 0) return []

  const ids = funnelRows.map(f => f.id)
  const { rows: stepRows } = await db.query<{
    funnel_id: number; position: number; event_name: string
  }>(`SELECT funnel_id, position, event_name FROM funnel_steps WHERE funnel_id = ANY($1::int[]) ORDER BY funnel_id, position`, [ids])

  return funnelRows.map(f => ({
    id: f.id,
    name: f.name,
    mode: f.mode as 'user' | 'company',
    windowDays: f.window_days,
    steps: stepRows.filter(s => s.funnel_id === f.id).map(s => ({ eventName: s.event_name })),
    createdAt: f.created_at,
  }))
}

// deleteFunnel — remove a saved funnel (steps cascade via FK).
export async function deleteFunnel(id: number): Promise<void> {
  await db.query(`DELETE FROM funnels WHERE id = $1`, [id])
}
