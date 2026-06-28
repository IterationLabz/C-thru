import { db } from './db'

export type SignalType =
  | 'active_users'
  | 'total_events'
  | 'days_since_active'
  | 'key_event_fired'
  | 'days_in_product'

export interface ReadinessRule {
  id: number
  label: string
  signal: SignalType
  operator: '>=' | '<='
  threshold: number
  window_days: number | null
  event_name: string | null
}

export interface RuleResult {
  ruleId: number
  label: string
  passed: boolean
  value: string
}

export interface CompanyScore {
  domain: string
  rulesMet: number
  rulesTotal: number
  breakdown: RuleResult[]
}

// Prebuilt domain maps fed into evaluateSignal — one map per signal type.
// Maps are built by scoreAllCompanies using batched GROUP BY queries (Issue #3).
export interface SignalMaps {
  activeUsers: Map<string, number>       // domain → count of active users in window
  totalEvents: Map<string, number>       // domain → count of events in window
  lastEventDaysAgo: Map<string, number>  // domain → days since last event
  keyEventFired: Map<string, Set<string>>// domain → set of fired event names
  daysInProduct: Map<string, number>     // domain → days since first signup
}

// evaluateSignal — the single tested seam for all five signal branches (D-21).
// Pure: reads from pre-built maps, never queries the DB.
export function evaluateSignal(
  rule: ReadinessRule,
  domain: string,
  maps: SignalMaps
): RuleResult {
  switch (rule.signal) {
    case 'active_users': {
      const count = maps.activeUsers.get(domain) ?? 0
      const passed = rule.operator === '>='
        ? count >= rule.threshold
        : count <= rule.threshold
      return { ruleId: rule.id, label: rule.label, passed, value: `${count} users` }
    }
    case 'total_events': {
      const count = maps.totalEvents.get(domain) ?? 0
      const passed = rule.operator === '>='
        ? count >= rule.threshold
        : count <= rule.threshold
      return { ruleId: rule.id, label: rule.label, passed, value: `${count} events` }
    }
    case 'days_since_active': {
      const days = maps.lastEventDaysAgo.get(domain)
      if (days === undefined) {
        return { ruleId: rule.id, label: rule.label, passed: false, value: 'never active' }
      }
      const passed = rule.operator === '>='
        ? days >= rule.threshold
        : days <= rule.threshold
      const daysLabel = days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
      return { ruleId: rule.id, label: rule.label, passed, value: `last active ${daysLabel}` }
    }
    case 'key_event_fired': {
      const firedEvents = maps.keyEventFired.get(domain) ?? new Set<string>()
      const eventName = rule.event_name ?? ''
      const passed = firedEvents.has(eventName)
      return {
        ruleId: rule.id,
        label: rule.label,
        passed,
        value: passed ? `fired ${eventName}` : `${eventName} never fired`,
      }
    }
    case 'days_in_product': {
      const days = maps.daysInProduct.get(domain)
      if (days === undefined) {
        return { ruleId: rule.id, label: rule.label, passed: false, value: 'no signups' }
      }
      const passed = rule.operator === '>='
        ? days >= rule.threshold
        : days <= rule.threshold
      return { ruleId: rule.id, label: rule.label, passed, value: `${days} days` }
    }
  }
}

// listRules — fetch all rules from DB ordered by id.
export async function listRules(): Promise<ReadinessRule[]> {
  const { rows } = await db.query<ReadinessRule>(
    'SELECT id, label, signal, operator, threshold::numeric, window_days, event_name FROM readiness_rules ORDER BY id'
  )
  return rows.map(r => ({ ...r, threshold: Number(r.threshold) }))
}
