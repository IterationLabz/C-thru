/**
 * Tests for the trigger lifecycle engine (D-27).
 *
 * createTriggeredDraft is mocked — these tests verify the state-machine logic
 * in evaluateTriggers (re-arm, de-dup, first-crossing), not the draft generation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '../db'

// Mock the draft creation to avoid LLM calls — we're testing the trigger engine logic.
vi.mock('../outreachDraft', async (importOriginal) => {
  const real = await importOriginal<typeof import('../outreachDraft')>()
  return {
    ...real,
    createTriggeredDraft: vi.fn().mockResolvedValue({ id: 99, domain: 'mock.com' }),
  }
})

import { evaluateTriggers, createTriggerRule, listTriggerRules } from '../triggerEngine'
import { createTriggeredDraft } from '../outreachDraft'

const mockCreateDraft = vi.mocked(createTriggeredDraft)

function makeScore(domain: string, rulesMet: number, rulesTotal = 5) {
  return { domain, rulesMet, rulesTotal, breakdown: [] }
}

beforeEach(() => {
  mockCreateDraft.mockClear()
  mockCreateDraft.mockResolvedValue({ id: 99, domain: 'mock.com' } as Awaited<ReturnType<typeof createTriggeredDraft>>)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function insertTriggerRule(label = 'test trigger', rulesMet = 4, rulesTotal = 5) {
  return createTriggerRule(label, rulesMet, rulesTotal)
}

async function getState(ruleId: number, domain: string) {
  const { rows } = await db.query<{ re_arm_eligible: boolean }>(
    `SELECT re_arm_eligible FROM trigger_domain_state WHERE trigger_rule_id = $1 AND domain = $2`,
    [ruleId, domain]
  )
  return rows[0] ?? null
}

// ---------------------------------------------------------------------------
// First crossing
// ---------------------------------------------------------------------------

describe('D-27 — first threshold crossing creates a draft', () => {
  it('creates a draft and inserts a trigger_domain_state row on first crossing', async () => {
    const rule = await insertTriggerRule('first cross', 3, 5)
    const scores = [makeScore('firstcross.com', 3)]

    await evaluateTriggers(scores)

    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
    expect(mockCreateDraft).toHaveBeenCalledWith('firstcross.com', rule.id, scores[0])

    const state = await getState(rule.id, 'firstcross.com')
    expect(state).not.toBeNull()
    expect(state!.re_arm_eligible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 7. DE-DUP: pending draft exists → no second draft
// ---------------------------------------------------------------------------

describe('D-27 — de-dup: no second draft while one is already pending', () => {
  it('does NOT call createTriggeredDraft when state row already exists with re_arm_eligible=false', async () => {
    const rule = await insertTriggerRule('dedup', 4, 5)
    // Simulate first crossing already happened: state row exists, re_arm_eligible = false
    await db.query(
      `INSERT INTO trigger_domain_state (trigger_rule_id, domain, re_arm_eligible) VALUES ($1, $2, false)`,
      [rule.id, 'dedup.com']
    )
    // Insert an actual pending draft to represent the existing one
    await db.query(
      `INSERT INTO outreach_drafts
         (domain, generated_text, draft_text, fact_block, created_by, trigger_rule_id, status)
       VALUES ('dedup.com', 'text', 'text', 'block', 'trigger', $1, 'pending')`,
      [rule.id]
    )

    const scores = [makeScore('dedup.com', 4)]
    await evaluateTriggers(scores)

    // createTriggeredDraft must NOT be called — de-dup prevents it
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it('evaluating the same score twice only produces one draft (idempotent on re-eval)', async () => {
    const rule = await insertTriggerRule('idempotent', 2, 5)
    const scores = [makeScore('once.com', 2)]

    await evaluateTriggers(scores) // first call — creates draft
    await evaluateTriggers(scores) // second call — state row exists, re_arm=false → no-op

    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// 6a. Account stays above threshold → NO re-draft
// ---------------------------------------------------------------------------

describe('D-27 — re-arm: account continuously above threshold does not re-draft', () => {
  it('re_arm_eligible stays false when account never dips below threshold', async () => {
    const rule = await insertTriggerRule('stay-hot', 3, 5)
    // First crossing
    await evaluateTriggers([makeScore('stayshot.com', 3)])
    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
    mockCreateDraft.mockClear()

    // Simulate founder sends/dismisses → flip re_arm_eligible to false is already the default.
    // Account stays above threshold — many subsequent evaluations.
    await evaluateTriggers([makeScore('stayshot.com', 4)])
    await evaluateTriggers([makeScore('stayshot.com', 5)])
    await evaluateTriggers([makeScore('stayshot.com', 3)])

    // No new drafts created
    expect(mockCreateDraft).not.toHaveBeenCalled()
    const state = await getState(rule.id, 'stayshot.com')
    expect(state!.re_arm_eligible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 6b. Account dips below and recrosses → re-draft
// ---------------------------------------------------------------------------

describe('D-27 — re-arm: dip-and-recross produces a new draft', () => {
  it('sets re_arm_eligible=true when score drops below threshold', async () => {
    const rule = await insertTriggerRule('dip', 4, 5)
    // First crossing
    await evaluateTriggers([makeScore('dipper.com', 4)])
    mockCreateDraft.mockClear()

    // Score drops below threshold
    await evaluateTriggers([makeScore('dipper.com', 2)])

    const state = await getState(rule.id, 'dipper.com')
    expect(state!.re_arm_eligible).toBe(true)
    // No new draft while below threshold
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it('creates a new draft when score recrosses the threshold after a dip', async () => {
    const rule = await insertTriggerRule('rearm', 4, 5)
    // First crossing
    await evaluateTriggers([makeScore('rearm.com', 4)])
    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
    mockCreateDraft.mockClear()

    // Dip below
    await evaluateTriggers([makeScore('rearm.com', 1)])

    // Recross threshold
    await evaluateTriggers([makeScore('rearm.com', 5)])

    // New draft must be created
    expect(mockCreateDraft).toHaveBeenCalledTimes(1)
    const state = await getState(rule.id, 'rearm.com')
    expect(state!.re_arm_eligible).toBe(false) // reset after re-arm fires
  })

  it('does NOT re-draft if score recrosses threshold WITHOUT having dipped first', async () => {
    const rule = await insertTriggerRule('no-dip-no-rearm', 3, 5)
    // First crossing at 3
    await evaluateTriggers([makeScore('nodip.com', 3)])
    mockCreateDraft.mockClear()

    // Score increases — still above threshold, never dipped
    await evaluateTriggers([makeScore('nodip.com', 4)])
    await evaluateTriggers([makeScore('nodip.com', 5)])

    expect(mockCreateDraft).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Multiple rules: each rule is evaluated independently
// ---------------------------------------------------------------------------

describe('D-27 — multiple trigger rules evaluated independently', () => {
  it('two rules each produce a draft on first crossing', async () => {
    const r1 = await insertTriggerRule('rule-a', 2, 5)
    const r2 = await insertTriggerRule('rule-b', 4, 5)
    const scores = [makeScore('multi.com', 4)] // satisfies both

    await evaluateTriggers(scores)

    expect(mockCreateDraft).toHaveBeenCalledTimes(2)
    const calls = mockCreateDraft.mock.calls.map(c => c[1])
    expect(calls).toContain(r1.id)
    expect(calls).toContain(r2.id)
  })

  it('no rules → evaluateTriggers is a no-op', async () => {
    // No rules inserted
    await evaluateTriggers([makeScore('norules.com', 5)])
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })
})
