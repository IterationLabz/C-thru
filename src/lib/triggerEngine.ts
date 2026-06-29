import { db } from './db'
import { type CompanyScore } from './readinessEngine'
import { createTriggeredDraft } from './outreachDraft'

export interface TriggerRule {
  id: number
  label: string
  rules_met_min: number
  rules_total: number
  created_at: Date
}

export async function listTriggerRules(): Promise<TriggerRule[]> {
  const { rows } = await db.query<TriggerRule>(
    'SELECT id, label, rules_met_min, rules_total, created_at FROM trigger_rules ORDER BY id'
  )
  return rows
}

export async function createTriggerRule(
  label: string,
  rulesMet: number,
  rulesTotal: number
): Promise<TriggerRule> {
  const { rows } = await db.query<TriggerRule>(
    `INSERT INTO trigger_rules (label, rules_met_min, rules_total) VALUES ($1, $2, $3) RETURNING *`,
    [label, rulesMet, rulesTotal]
  )
  return rows[0]!
}

export async function deleteTriggerRule(id: number): Promise<void> {
  await db.query('DELETE FROM trigger_rules WHERE id = $1', [id])
}

// evaluateTriggers — synchronous on page load, no background workers (D-27).
// For each trigger rule, checks each scored company:
//   - above threshold + no pending draft + re_arm_eligible (or first time) → create draft
//   - below threshold → set re_arm_eligible = true on the state row
export async function evaluateTriggers(scores: CompanyScore[]): Promise<void> {
  const rules = await listTriggerRules()
  if (rules.length === 0 || scores.length === 0) return

  for (const rule of rules) {
    for (const score of scores) {
      const aboveThreshold = score.rulesMet >= rule.rules_met_min

      // Fetch or initialise the state row for this (rule, domain) pair.
      const { rows: stateRows } = await db.query<{ re_arm_eligible: boolean }>(
        `SELECT re_arm_eligible FROM trigger_domain_state
         WHERE trigger_rule_id = $1 AND domain = $2`,
        [rule.id, score.domain]
      )
      const stateRow = stateRows[0]

      if (!aboveThreshold) {
        if (stateRow) {
          // Score dipped below threshold — mark re-arm eligible (D-27).
          await db.query(
            `UPDATE trigger_domain_state SET re_arm_eligible = true
             WHERE trigger_rule_id = $1 AND domain = $2`,
            [rule.id, score.domain]
          )
        }
        continue
      }

      // Above threshold.
      if (!stateRow) {
        // First ever crossing for this (rule, domain) — create draft.
        await db.query(
          `INSERT INTO trigger_domain_state (trigger_rule_id, domain, re_arm_eligible)
           VALUES ($1, $2, false)`,
          [rule.id, score.domain]
        )
        await createTriggeredDraft(score.domain, rule.id, score)
      } else if (stateRow.re_arm_eligible) {
        // Dipped below and came back above — re-arm cycle (D-27).
        await db.query(
          `UPDATE trigger_domain_state SET re_arm_eligible = false
           WHERE trigger_rule_id = $1 AND domain = $2`,
          [rule.id, score.domain]
        )
        await createTriggeredDraft(score.domain, rule.id, score)
      }
      // stateRow exists and re_arm_eligible = false → account stayed above threshold → no-op.
    }
  }
}
