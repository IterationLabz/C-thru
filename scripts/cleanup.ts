// Retention cleanup service entry point (D-31).
//
// This script is the ONLY import surface for the cleanup Docker service.
// It imports runRetentionCleanup and the DB client — nothing else.
//
// SCOPE BOUNDARY (grep test assertion): this file must NEVER import or call
// any function from the outreach or trigger surface (D-26/D-31).
// The D-26 grep test is updated to assert this boundary.

import { runRetentionCleanup } from '../src/lib/replay/cleanup'

async function main() {
  console.log(`[cleanup] starting retention run at ${new Date().toISOString()}`)
  try {
    const result = await runRetentionCleanup()
    console.log(
      `[cleanup] done — sessions_deleted=${result.sessionsDeleted} ` +
      `bytes_freed=${result.bytesFreed} ran_at=${result.ranAt.toISOString()}`
    )
  } catch (err) {
    console.error('[cleanup] error:', err)
    process.exit(1)
  }
  process.exit(0)
}

main()
