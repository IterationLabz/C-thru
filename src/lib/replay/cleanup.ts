// Retention cleanup service (D-31).
//
// C-thru's first scheduled background job. Consistent with D-26 (which banned
// auto-SEND from a scheduler, not all background work). Retention is maintenance
// with no human-action substitute — a privacy guarantee that depends on page
// visits is not a guarantee.
//
// runRetentionCleanup():
//   - Deletes all chunks for expired sessions (by-session, never orphaned chunks)
//   - Then deletes the session rows
//   - Idempotent: running twice produces the same result
//   - Returns { sessionsDeleted, bytesFreed, ranAt } for audit logging
//
// SCOPE BOUNDARY (enforced by the D-26 updated grep test):
// This module imports ONLY the DB client. It must never import or call any
// function from the outreach/trigger surface (D-26). See actLoopContracts.test.ts.

import { db } from '../db'

export interface CleanupResult {
  sessionsDeleted: number
  bytesFreed: number
  ranAt: Date
}

export async function runRetentionCleanup(): Promise<CleanupResult> {
  const ranAt = new Date()

  // Find all expired session IDs in one query.
  const { rows: expiredRows } = await db.query<{ session_id: string }>(
    `SELECT session_id FROM session_recordings WHERE expires_at < NOW()`
  )

  if (expiredRows.length === 0) {
    return { sessionsDeleted: 0, bytesFreed: 0, ranAt }
  }

  const sessionIds = expiredRows.map(r => r.session_id)

  // Measure bytes freed before deletion (for the audit log).
  const { rows: sizeRows } = await db.query<{ bytes_freed: string }>(
    `SELECT COALESCE(SUM(octet_length(data)), 0)::text AS bytes_freed
     FROM session_recording_chunks
     WHERE session_id = ANY($1::uuid[])`,
    [sessionIds]
  )
  const bytesFreed = parseInt(sizeRows[0]?.bytes_freed ?? '0', 10)

  // Delete chunks first (FK: chunks reference sessions).
  // ON DELETE CASCADE on the FK would handle this automatically, but we delete
  // explicitly to make the by-session guarantee visible and auditable.
  await db.query(
    `DELETE FROM session_recording_chunks WHERE session_id = ANY($1::uuid[])`,
    [sessionIds]
  )

  // Then delete the session rows.
  const { rowCount } = await db.query(
    `DELETE FROM session_recordings WHERE session_id = ANY($1::uuid[])`,
    [sessionIds]
  )

  const sessionsDeleted = rowCount ?? 0
  return { sessionsDeleted, bytesFreed, ranAt }
}
