/**
 * Structural contract tests for the Act Loop (D-26, D-27).
 * These tests make assertions about source code structure and function signatures —
 * not about runtime behavior. No DB or LLM calls.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walkSrc(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...walkSrc(full))
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      results.push(full)
    }
  }
  return results
}

const SRC_DIR = join(process.cwd(), 'src')

// Files that are ALLOWED to contain the send/trigger identifiers (D-26 grep test).
const ALLOWED_RELATIVE = new Set([
  'app/outreach/actions.ts',
  'app/outreach/page.tsx',
  'app/outreach/[id]/DraftActions.tsx',
  'lib/triggerEngine.ts',
  'lib/outreachDraft.ts',
])

// ---------------------------------------------------------------------------
// 1. NEVER-AUTO-SEND GREP TEST (D-26)
// ---------------------------------------------------------------------------

describe('D-26 grep test — send/trigger identifiers only in allowed files', () => {
  const PATTERN = /\b(sendSlack|recordCopy|evaluateTriggers)\b/

  it('every file containing sendSlack, recordCopy, or evaluateTriggers is in the allowed set', () => {
    const violations: string[] = []
    for (const abs of walkSrc(SRC_DIR)) {
      const rel = relative(SRC_DIR, abs)
      // Skip the test files themselves
      if (rel.includes('__tests__')) continue
      const content = readFileSync(abs, 'utf-8')
      if (PATTERN.test(content) && !ALLOWED_RELATIVE.has(rel)) {
        violations.push(rel)
      }
    }
    expect(violations, `Unexpected files contain send/trigger identifiers:\n${violations.join('\n')}`).toHaveLength(0)
  })

  it('the allowed send-path files do not import scheduler libraries', () => {
    // Check for imports from actual scheduler packages — NOT just the word "cron"
    // (comments like "no cron, no queue" are expected and should not fail this test).
    const SCHEDULER_IMPORT = /from\s+['"](?:node-cron|bull|bullmq|bee-queue|pg-boss|agenda|node-schedule|cron)['"]|require\(['"](?:node-cron|bull|bullmq|bee-queue|pg-boss|agenda|node-schedule|cron)['"]\)/
    const violations: string[] = []
    for (const rel of ALLOWED_RELATIVE) {
      const abs = join(SRC_DIR, rel)
      try {
        const content = readFileSync(abs, 'utf-8')
        if (SCHEDULER_IMPORT.test(content)) {
          violations.push(rel)
        }
      } catch {
        // File doesn't exist yet — skip
      }
    }
    expect(violations, `Allowed send-path files import scheduler libraries:\n${violations.join('\n')}`).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 3. SINGLE-ACCOUNT-ONLY SEND (D-26)
// ---------------------------------------------------------------------------

describe('D-26 — send actions are single-account only, no batch endpoint', () => {
  it('sendSlack accepts a single draftId number, not an array', async () => {
    const mod = await import('../outreachDraft')
    // Check the function exists and its length matches single-item signature (draftId, recipient, text)
    expect(typeof mod.sendSlack).toBe('function')
    expect(mod.sendSlack.length).toBe(3) // (draftId, recipient, editedText)
  })

  it('recordCopy accepts a single draftId number, not an array', async () => {
    const mod = await import('../outreachDraft')
    expect(typeof mod.recordCopy).toBe('function')
    expect(mod.recordCopy.length).toBe(3) // (draftId, recipient, editedText)
  })

  it('no file in src/ defines a batch send endpoint (sendDrafts, sendBatch, bulkSend)', () => {
    const BATCH_PATTERN = /\b(sendDrafts|sendBatch|bulkSend|sendAll)\b/
    const matches: string[] = []
    for (const abs of walkSrc(SRC_DIR)) {
      const rel = relative(SRC_DIR, abs)
      if (rel.includes('__tests__')) continue
      const content = readFileSync(abs, 'utf-8')
      if (BATCH_PATTERN.test(content)) matches.push(rel)
    }
    expect(matches, `Batch send identifiers found:\n${matches.join('\n')}`).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// D-31 CLEANUP SCOPE BOUNDARY (updated D-26 grep test for v0.5)
//
// The retention cleanup service is C-thru's first scheduled background job.
// It must ONLY import the cleanup module and the DB client — never the
// send/trigger surface. This test asserts that boundary in both directions.
// ---------------------------------------------------------------------------

describe('D-31 — cleanup service scope boundary (updated D-26 grep test)', () => {
  const CLEANUP_ENTRY = join(process.cwd(), 'scripts/cleanup.ts')
  const SEND_TRIGGER_PATTERN = /\b(sendSlack|recordCopy|evaluateTriggers|createTriggeredDraft)\b/

  it('cleanup service entry point exists (D-31 first background job)', () => {
    try {
      readFileSync(CLEANUP_ENTRY, 'utf-8')
    } catch {
      throw new Error('scripts/cleanup.ts does not exist — D-31 cleanup service not found')
    }
  })

  it('cleanup service entry point does NOT import send/trigger surface', () => {
    const content = readFileSync(CLEANUP_ENTRY, 'utf-8')
    expect(
      SEND_TRIGGER_PATTERN.test(content),
      'scripts/cleanup.ts references send/trigger surface — violates D-31 scope boundary'
    ).toBe(false)
  })

  it('cleanup module (replay/cleanup.ts) does NOT import send/trigger surface', () => {
    const abs = join(SRC_DIR, 'lib/replay/cleanup.ts')
    const content = readFileSync(abs, 'utf-8')
    expect(
      SEND_TRIGGER_PATTERN.test(content),
      'src/lib/replay/cleanup.ts references send/trigger surface — violates D-31 scope boundary'
    ).toBe(false)
  })

  it('docker-compose.yml defines a cleanup service (D-31 single docker compose up)', () => {
    const composeContent = readFileSync(join(process.cwd(), 'docker-compose.yml'), 'utf-8')
    expect(composeContent).toContain('cleanup:')
  })
})

// ---------------------------------------------------------------------------
// 12. PLACEHOLDER GUARD
// ---------------------------------------------------------------------------

describe('placeholder guard — no stub functions returning always-true', () => {
  it('isSuppressed in suppressionList.ts queries the DB — no stub return', () => {
    const abs = join(SRC_DIR, 'lib/suppressionList.ts')
    const content = readFileSync(abs, 'utf-8')
    // Stubs would look like: return false or return Promise.resolve(false)
    expect(content).not.toMatch(/return\s+(false|Promise\.resolve\(false\))/)
    // Must contain a db.query call
    expect(content).toContain('db.query')
  })

  it('outreachDraft.ts actually calls isSuppressed (not a TODO)', () => {
    const abs = join(SRC_DIR, 'lib/outreachDraft.ts')
    const content = readFileSync(abs, 'utf-8')
    expect(content).toContain('isSuppressed')
    expect(content).not.toMatch(/TODO.*suppress/i)
  })

  it('outreachDraft.ts actually calls withinCooldown (not a TODO)', () => {
    const abs = join(SRC_DIR, 'lib/outreachDraft.ts')
    const content = readFileSync(abs, 'utf-8')
    expect(content).toContain('withinCooldown')
    expect(content).not.toMatch(/TODO.*cooldown/i)
  })
})
