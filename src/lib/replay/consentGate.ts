// Consent gate for session replay (D-37).
//
// replay_settings has a single-row singleton (id=1, enforced by CHECK constraint).
//
// RULES:
//   - Replay is OFF by default (enabled=false).
//   - enableReplay() requires clauseVersion > 0: persists acknowledged_at +
//     acknowledged_clause_version so the founder's acceptance is auditable.
//   - Passing no clauseVersion (or 0) throws — you cannot enable without
//     acknowledging the disclosure clause.
//   - disableReplay() sets enabled=false but preserves acknowledged_at (audit trail).
//   - updateRetentionDays() + updateSampleRate() are independent of enable/disable.

import { db } from '../db'

export const CURRENT_CLAUSE_VERSION = 1

export interface ReplaySettings {
  enabled: boolean
  retentionDays: number
  sampleRate: number
  acknowledgedAt: Date | null
  acknowledgedClauseVersion: number | null
  updatedAt: Date
}

export async function getReplaySettings(): Promise<ReplaySettings> {
  const { rows } = await db.query<{
    enabled: boolean
    retention_days: number
    sample_rate: string
    acknowledged_at: Date | null
    acknowledged_clause_version: number | null
    updated_at: Date
  }>(`SELECT * FROM replay_settings WHERE id = 1`)

  const row = rows[0]!
  return {
    enabled: row.enabled,
    retentionDays: row.retention_days,
    sampleRate: parseFloat(row.sample_rate),
    acknowledgedAt: row.acknowledged_at,
    acknowledgedClauseVersion: row.acknowledged_clause_version,
    updatedAt: row.updated_at,
  }
}

// enableReplay() requires a valid clauseVersion (>0).
// Throws if clauseVersion is missing or zero — cannot enable without disclosure acknowledgment.
export async function enableReplay(clauseVersion: number): Promise<void> {
  if (!clauseVersion || clauseVersion <= 0) {
    throw new Error(
      'Cannot enable replay without acknowledging the disclosure clause. clauseVersion must be > 0.'
    )
  }
  await db.query(
    `UPDATE replay_settings
     SET enabled = true,
         acknowledged_at = NOW(),
         acknowledged_clause_version = $1,
         updated_at = NOW()
     WHERE id = 1`,
    [clauseVersion]
  )
}

// disableReplay() stops capture but preserves acknowledged_at (audit trail).
export async function disableReplay(): Promise<void> {
  await db.query(
    `UPDATE replay_settings
     SET enabled = false,
         updated_at = NOW()
     WHERE id = 1`
  )
}

export async function updateRetentionDays(days: number): Promise<void> {
  if (days < 1) throw new Error('retentionDays must be >= 1')
  await db.query(
    `UPDATE replay_settings
     SET retention_days = $1, updated_at = NOW()
     WHERE id = 1`,
    [days]
  )
}

export async function updateSampleRate(rate: number): Promise<void> {
  if (rate < 0 || rate > 1) throw new Error('sampleRate must be in [0, 1]')
  await db.query(
    `UPDATE replay_settings
     SET sample_rate = $1, updated_at = NOW()
     WHERE id = 1`,
    [rate]
  )
}
