/**
 * Tests for the Act Loop core guarantees (D-25, D-26, D-28, D-29, D-30).
 *
 * LLM (ai module) is mocked throughout — these tests verify guardrail logic,
 * not LLM output quality. The mock returns a fixed string so DB state is
 * predictable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateText } from 'ai'

vi.mock('ai', () => ({ generateText: vi.fn() }))
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: vi.fn(() => vi.fn(() => 'mock-model')) }))
vi.mock('@ai-sdk/openai',    () => ({ createOpenAI:    vi.fn(() => vi.fn(() => 'mock-model')) }))
vi.mock('@ai-sdk/groq',      () => ({ createGroq:      vi.fn(() => vi.fn(() => 'mock-model')) }))

const mockGenerateText = vi.mocked(generateText)
const GENERATED = 'Hi, your team has been active on our platform — happy to help.'

beforeEach(() => {
  mockGenerateText.mockReset()
  mockGenerateText.mockResolvedValue({ text: GENERATED } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never)
  vi.stubEnv('CTHRU_LLM_KEY',      'test-key')
  vi.stubEnv('CTHRU_LLM_PROVIDER', 'anthropic')
  vi.stubEnv('CTHRU_LLM_MODEL',    'claude-haiku-4-5-20251001')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { db } from '../db'

/** Insert a minimal pending draft and return its id. */
async function insertDraft(domain = 'acme.com', generatedText = GENERATED): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO outreach_drafts
       (domain, generated_text, draft_text, fact_block, created_by)
     VALUES ($1, $2, $2, 'fact block', 'manual')
     RETURNING id`,
    [domain, generatedText]
  )
  return rows[0]!.id
}

/** Insert an outreach_log entry to simulate a prior send (for cooldown tests). */
async function insertLogEntry(domain: string, daysAgo = 0): Promise<void> {
  const draftId = await insertDraft(domain)
  const actioned = new Date(Date.now() - daysAgo * 86_400_000).toISOString()
  await db.query(
    `INSERT INTO outreach_log
       (draft_id, domain, channel, draft_text_snapshot, created_by, actioned_at)
     VALUES ($1, $2, 'clipboard_copied', 'some text', 'manual', $3)`,
    [draftId, domain, actioned]
  )
}

/** Insert an active user for a domain so scoreCompany returns a result. */
async function seedDomain(domain: string): Promise<void> {
  const email = `alice@${domain}`
  await db.query(`INSERT INTO users (user_id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [`user-${domain}`, email])
  await db.query(
    `INSERT INTO aliases (anonymous_id, user_id, email)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [`anon-${domain}`, `user-${domain}`, email]
  )
  await db.query(
    `INSERT INTO events (anonymous_id, name, source, occurred_at, received_at)
     VALUES ($1, 'pageview', 'auto', NOW(), NOW())`,
    [`anon-${domain}`]
  )
}

// ---------------------------------------------------------------------------
// 2. SEND IDEMPOTENCY (D-26)
// ---------------------------------------------------------------------------

describe('D-26 — send idempotency: draft can only be sent once', () => {
  it('recordCopy on an already-sent draft throws ALREADY_SENT', async () => {
    const { recordCopy } = await import('../outreachDraft')
    const id = await insertDraft('once.com')
    // First send
    await recordCopy(id, null, 'text v1')
    // Second send
    await expect(recordCopy(id, null, 'text v2')).rejects.toThrow('ALREADY_SENT')
  })

  it('exactly ONE outreach_log row exists after two recordCopy attempts', async () => {
    const { recordCopy } = await import('../outreachDraft')
    const id = await insertDraft('once2.com')
    await recordCopy(id, null, 'text v1')
    try { await recordCopy(id, null, 'text v2') } catch { /* expected */ }

    const { rows } = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM outreach_log WHERE draft_id = $1`,
      [id]
    )
    expect(Number(rows[0]!.cnt)).toBe(1)
  })

  it('sendSlack on an already-sent draft throws ALREADY_SENT (before any webhook call)', async () => {
    const { sendSlack } = await import('../outreachDraft')
    // Configure slack webhook URL
    await db.query(`UPDATE outreach_settings SET slack_webhook_url = 'https://hooks.slack.com/test' WHERE id = 1`)
    // Create the mock first, then stub the global with it
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    const id = await insertDraft('once3.com')
    // Mark draft as already sent
    await db.query(`UPDATE outreach_drafts SET status = 'sent', sent_at = NOW() WHERE id = $1`, [id])

    await expect(sendSlack(id, null, 'text')).rejects.toThrow('ALREADY_SENT')
    // fetch should NOT have been called for the already-sent case
    expect(fetchMock).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})

// ---------------------------------------------------------------------------
// 4. SUPPRESSION — HARD-BLOCK AT BOTH ENDS (D-29)
// ---------------------------------------------------------------------------

describe('D-29 — suppression hard-blocks draft creation', () => {
  it('createManualDraft throws when the domain is on the suppression list', async () => {
    const { addSuppression } = await import('../suppressionList')
    const { createManualDraft } = await import('../outreachDraft')
    await seedDomain('suppress-me.com')
    await addSuppression('domain', 'suppress-me.com')
    await expect(createManualDraft('suppress-me.com')).rejects.toThrow('suppression list')
  })

  it('createTriggeredDraft returns null (silent) when the domain is suppressed', async () => {
    const { addSuppression } = await import('../suppressionList')
    const { createTriggeredDraft } = await import('../outreachDraft')
    await seedDomain('suppress-trigger.com')
    await addSuppression('domain', 'suppress-trigger.com')

    // Build a minimal CompanyScore for the call signature
    const score = { domain: 'suppress-trigger.com', rulesMet: 3, rulesTotal: 5, breakdown: [] }
    const result = await createTriggeredDraft('suppress-trigger.com', 1, score)
    expect(result).toBeNull()
  })

  it('recordCopy throws when domain is suppressed after draft creation', async () => {
    const { addSuppression } = await import('../suppressionList')
    const { recordCopy } = await import('../outreachDraft')
    const id = await insertDraft('late-suppress.com')
    // Suppressed AFTER the draft was created — caught at send time
    await addSuppression('domain', 'late-suppress.com')
    await expect(recordCopy(id, null, 'text')).rejects.toThrow('suppression list')
  })

  it('sendSlack throws when domain is suppressed at send time', async () => {
    const { addSuppression } = await import('../suppressionList')
    const { sendSlack } = await import('../outreachDraft')
    await db.query(`UPDATE outreach_settings SET slack_webhook_url = 'https://hooks.slack.com/test' WHERE id = 1`)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const id = await insertDraft('late-suppress-slack.com')
    await addSuppression('domain', 'late-suppress-slack.com')
    await expect(sendSlack(id, null, 'text')).rejects.toThrow('suppression list')

    vi.unstubAllGlobals()
  })

  it('suppression has no override path — no draft created even for manual (unlike cooldown)', async () => {
    const { addSuppression } = await import('../suppressionList')
    const { createManualDraft } = await import('../outreachDraft')
    await seedDomain('no-override.com')
    await addSuppression('domain', 'no-override.com')

    // There is no "force" parameter or override path — it must throw
    await expect(createManualDraft('no-override.com')).rejects.toThrow()

    const { rows } = await db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM outreach_drafts WHERE domain = 'no-override.com'`
    )
    expect(Number(rows[0]!.cnt)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5. COOLDOWN ASYMMETRY (D-29)
// ---------------------------------------------------------------------------

describe('D-29 — cooldown: triggered=silent suppress, manual=warn-but-allow', () => {
  it('createTriggeredDraft returns null silently within cooldown window', async () => {
    const { createTriggeredDraft } = await import('../outreachDraft')
    await seedDomain('cooldown-trigger.com')
    // Simulate a prior send 5 days ago (within 21-day default cooldown)
    await insertLogEntry('cooldown-trigger.com', 5)

    const score = { domain: 'cooldown-trigger.com', rulesMet: 5, rulesTotal: 5, breakdown: [] }
    const result = await createTriggeredDraft('cooldown-trigger.com', 1, score)
    expect(result).toBeNull()
    // LLM was never called
    expect(mockGenerateText).not.toHaveBeenCalled()
  })

  it('createManualDraft within cooldown creates the draft AND returns a warning', async () => {
    const { createManualDraft } = await import('../outreachDraft')
    await seedDomain('cooldown-manual.com')
    // Simulate a prior send 3 days ago
    await insertLogEntry('cooldown-manual.com', 3)

    const result = await createManualDraft('cooldown-manual.com')
    // Draft was created (warn-but-allow)
    expect(result.draft).toBeDefined()
    expect(result.draft.id).toBeGreaterThan(0)
    // Warning is present
    expect(result.cooldownWarning).toContain('cooldown-manual.com')
    expect(result.cooldownWarning).toMatch(/\d+ days/)
  })

  it('createTriggeredDraft succeeds after the cooldown window has passed', async () => {
    const { createTriggeredDraft } = await import('../outreachDraft')
    const { createTriggerRule } = await import('../triggerEngine')
    await seedDomain('cooldown-expired.com')
    // Simulate a prior send 25 days ago (beyond 21-day default)
    await insertLogEntry('cooldown-expired.com', 25)

    // Need a real trigger rule for the FK constraint
    const rule = await createTriggerRule('expired cooldown test', 3, 5)
    const score = { domain: 'cooldown-expired.com', rulesMet: 5, rulesTotal: 5, breakdown: [] }
    const result = await createTriggeredDraft('cooldown-expired.com', rule.id, score)
    expect(result).not.toBeNull()
    expect(result!.domain).toBe('cooldown-expired.com')
  })

  it('createManualDraft with no prior contact has no warning', async () => {
    const { createManualDraft } = await import('../outreachDraft')
    await seedDomain('fresh.com')

    const result = await createManualDraft('fresh.com')
    expect(result.cooldownWarning).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 8. SNAPSHOT FREEZES AT ACTION TIME (D-28)
// ---------------------------------------------------------------------------

describe('D-28 — draft_text_snapshot records edited text, not generated text', () => {
  it('recordCopy logs the text passed in, not the original generated text', async () => {
    const { recordCopy } = await import('../outreachDraft')
    const id = await insertDraft('snapshot.com', 'GENERATED TEXT')
    const EDITED = 'FOUNDER EDITED THIS BEFORE COPYING'

    await recordCopy(id, 'alice@snapshot.com', EDITED)

    const { rows } = await db.query<{ draft_text_snapshot: string }>(
      `SELECT draft_text_snapshot FROM outreach_log WHERE draft_id = $1`,
      [id]
    )
    expect(rows[0]!.draft_text_snapshot).toBe(EDITED)
    expect(rows[0]!.draft_text_snapshot).not.toBe('GENERATED TEXT')
  })

  it('sendSlack logs the edited text, not the generated text', async () => {
    const { sendSlack } = await import('../outreachDraft')
    await db.query(`UPDATE outreach_settings SET slack_webhook_url = 'https://hooks.slack.com/test' WHERE id = 1`)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    const id = await insertDraft('snapshot-slack.com', 'GENERATED')
    const EDITED = 'FOUNDER EDITED FOR SLACK'

    await sendSlack(id, 'alice@snapshot-slack.com', EDITED)

    const { rows } = await db.query<{ draft_text_snapshot: string }>(
      `SELECT draft_text_snapshot FROM outreach_log WHERE draft_id = $1`,
      [id]
    )
    expect(rows[0]!.draft_text_snapshot).toBe(EDITED)

    vi.unstubAllGlobals()
  })

  it('recipient in outreach_log reflects what the founder typed, not the default', async () => {
    const { recordCopy } = await import('../outreachDraft')
    const id = await insertDraft('recipient-test.com')
    const CUSTOM_RECIPIENT = 'custom@recipient-test.com'

    await recordCopy(id, CUSTOM_RECIPIENT, 'any text')

    const { rows } = await db.query<{ recipient: string }>(
      `SELECT recipient FROM outreach_log WHERE draft_id = $1`,
      [id]
    )
    expect(rows[0]!.recipient).toBe(CUSTOM_RECIPIENT)
  })
})

// ---------------------------------------------------------------------------
// 9. UNGROUNDED-CLAIMS FLAG (D-25)
// ---------------------------------------------------------------------------

describe('D-25 — scanUngroundedClaims', () => {
  it('flags "I noticed you\\u2019ve been exploring" as an ungrounded claim', async () => {
    const { scanUngroundedClaims } = await import('../outreachDraft')
    const warnings = scanUngroundedClaims("I noticed you've been exploring our billing page.")
    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]).toContain('⚠')
  })

  it('flags "I saw you" as an ungrounded claim', async () => {
    const { scanUngroundedClaims } = await import('../outreachDraft')
    const warnings = scanUngroundedClaims('I saw you using the dashboard yesterday.')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('does NOT flag a grounded statement referencing data from the fact block', async () => {
    const { scanUngroundedClaims } = await import('../outreachDraft')
    // This statement is grounded — it could come directly from the fact block
    const warnings = scanUngroundedClaims(
      'Your team has been active — 7 users in the last 30 days. Happy to help you get more out of it.'
    )
    expect(warnings).toHaveLength(0)
  })

  it('flags "it looks like" as an ungrounded behavioural inference', async () => {
    const { scanUngroundedClaims } = await import('../outreachDraft')
    const warnings = scanUngroundedClaims('It looks like your team is evaluating our product.')
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('scan runs regardless of voice sample presence — voice does not disable the gate', async () => {
    // Set a voice sample
    await db.query(`UPDATE outreach_settings SET voice_sample = 'hey there, casual tone' WHERE id = 1`)

    const { generateDraftText } = await import('../outreachDraft')
    // Mock LLM to return a text containing an ungrounded claim
    mockGenerateText.mockResolvedValueOnce({
      text: "I noticed you've been exploring our billing page.",
    } as ReturnType<typeof generateText> extends Promise<infer T> ? T : never)

    const { scanUngroundedClaims } = await import('../outreachDraft')
    const text = await generateDraftText('some fact block', 'hey there, casual tone')
    const warnings = scanUngroundedClaims(text)

    expect(warnings.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 10. VOICE DOESN'T RELAX GROUNDING (D-30)
// ---------------------------------------------------------------------------

describe('D-30 — voice sample sits alongside grounding constraint, not instead of it', () => {
  it('generateDraftText includes grounding constraint regardless of voice sample', async () => {
    const { generateDraftText } = await import('../outreachDraft')
    const VOICE_SAMPLE = 'hey, super casual, love helping teams win'

    await generateDraftText('the fact block text', VOICE_SAMPLE)

    const call = mockGenerateText.mock.calls[0]![0]
    const systemPrompt = (call as { system?: string }).system ?? ''

    // Grounding constraint must be present
    expect(systemPrompt).toMatch(/use only these facts|do not infer/i)
    // Voice instruction must ALSO be present
    expect(systemPrompt).toContain(VOICE_SAMPLE)
  })

  it('generateDraftText without voice sample still includes grounding constraint', async () => {
    const { generateDraftText } = await import('../outreachDraft')
    await generateDraftText('the fact block text', null)

    const call = mockGenerateText.mock.calls[0]![0]
    const systemPrompt = (call as { system?: string }).system ?? ''

    expect(systemPrompt).toMatch(/use only these facts|do not infer/i)
  })

  it('fact block is passed to the LLM prompt, not just the system message', async () => {
    const { generateDraftText } = await import('../outreachDraft')
    const FACT_BLOCK = 'Company: acme.com\nRules met: 4/5'

    await generateDraftText(FACT_BLOCK, null)

    const call = mockGenerateText.mock.calls[0]![0]
    const prompt = (call as { prompt?: string }).prompt ?? ''
    expect(prompt).toContain(FACT_BLOCK)
  })
})

// ---------------------------------------------------------------------------
// 11. VOICE HARD-DELETE (D-30)
// ---------------------------------------------------------------------------

describe('D-30 — voice sample hard-delete removes row data entirely', () => {
  it('deleteVoiceSample sets voice_sample to NULL — no removed_at, no archive', async () => {
    const { saveVoiceSample, deleteVoiceSample } = await import('../outreachDraft')

    await saveVoiceSample('my writing style sample here')
    // Confirm it was saved
    const { rows: before } = await db.query<{ voice_sample: string | null }>(
      `SELECT voice_sample FROM outreach_settings WHERE id = 1`
    )
    expect(before[0]!.voice_sample).toBe('my writing style sample here')

    await deleteVoiceSample()

    // voice_sample is NULL — not archived, not soft-deleted
    const { rows: after } = await db.query<{ voice_sample: string | null }>(
      `SELECT voice_sample FROM outreach_settings WHERE id = 1`
    )
    expect(after[0]!.voice_sample).toBeNull()

    // The settings row still exists (it's the singleton)
    expect(after).toHaveLength(1)
  })

  it('outreach_settings has no removed_at column — voice deletion is architecturally hard', async () => {
    // The settings table must NOT have a removed_at column (unlike suppression_list)
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'outreach_settings' AND column_name = 'removed_at'`
    )
    expect(rows).toHaveLength(0)
  })

  it('suppression_list HAS removed_at — distinguishing the two deletion semantics', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'suppression_list' AND column_name = 'removed_at'`
    )
    expect(rows).toHaveLength(1)
  })
})
