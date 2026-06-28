import { db } from './db'

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
