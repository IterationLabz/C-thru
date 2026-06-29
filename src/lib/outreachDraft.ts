import { db } from './db'
import { scoreCompany, type CompanyScore } from './readinessEngine'
import { isSuppressed } from './suppressionList'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGroq } from '@ai-sdk/groq'

export interface OutreachSettings {
  cooldown_days: number
  slack_webhook_url: string | null
  voice_sample: string | null
}

export interface TopUser {
  email: string
  total_events: number
}

export interface OutreachDraft {
  id: number
  domain: string
  status: 'pending' | 'sent' | 'dismissed'
  generated_text: string
  draft_text: string
  fact_block: string
  created_by: 'trigger' | 'manual'
  trigger_rule_id: number | null
  triggered_at: Date | null
  sent_at: Date | null
  dismissed_at: Date | null
  created_at: Date
}

export interface OutreachLogEntry {
  id: number
  draft_id: number
  domain: string
  channel: 'slack' | 'clipboard_copied'
  recipient: string | null
  draft_text_snapshot: string
  created_by: 'trigger' | 'manual'
  trigger_rule_id: number | null
  actioned_at: Date
}

export async function getOutreachSettings(): Promise<OutreachSettings> {
  const { rows } = await db.query<OutreachSettings>(
    'SELECT cooldown_days, slack_webhook_url, voice_sample FROM outreach_settings WHERE id = 1'
  )
  return rows[0] ?? { cooldown_days: 21, slack_webhook_url: null, voice_sample: null }
}

export async function saveOutreachSettings(
  partial: Partial<Pick<OutreachSettings, 'cooldown_days' | 'slack_webhook_url'>>
): Promise<void> {
  const sets: string[] = ['updated_at = NOW()']
  const vals: unknown[] = []
  let i = 1
  if (partial.cooldown_days !== undefined) { sets.push(`cooldown_days = $${i++}`); vals.push(partial.cooldown_days) }
  if (partial.slack_webhook_url !== undefined) { sets.push(`slack_webhook_url = $${i++}`); vals.push(partial.slack_webhook_url || null) }
  if (sets.length === 1) return
  await db.query(`UPDATE outreach_settings SET ${sets.join(', ')} WHERE id = 1`, vals)
}

export async function saveVoiceSample(sample: string): Promise<void> {
  await db.query(
    `UPDATE outreach_settings SET voice_sample = $1, updated_at = NOW() WHERE id = 1`,
    [sample.trim() || null]
  )
}

export async function deleteVoiceSample(): Promise<void> {
  await db.query(`UPDATE outreach_settings SET voice_sample = NULL, updated_at = NOW() WHERE id = 1`)
}

export async function getTopUsers(domain: string): Promise<TopUser[]> {
  const { rows } = await db.query<{ email: string; total_events: string }>(
    `SELECT email, total_events
     FROM active_users_v
     WHERE company_domain = $1
       AND email IS NOT NULL
     ORDER BY total_events DESC
     LIMIT 3`,
    [domain]
  )
  return rows.map(r => ({ email: r.email, total_events: Number(r.total_events) }))
}

export function buildFactBlock(score: CompanyScore, topUsers: TopUser[]): string {
  const lines: string[] = [
    `Company: ${score.domain}`,
    `Rules met: ${score.rulesMet}/${score.rulesTotal}`,
  ]
  for (const r of score.breakdown) {
    lines.push(`  ${r.passed ? '✓' : '✗'} ${r.label} — ${r.value}`)
  }
  if (topUsers.length > 0) {
    lines.push('\nTop users (last 7 days):')
    for (const u of topUsers) {
      lines.push(`  ${u.email} — ${u.total_events} events`)
    }
  }
  return lines.join('\n')
}

// Phrases that imply observed behaviour not in the fact block (D-25).
const UNGROUNDED_PATTERNS = [
  /\bI (saw|noticed|observed)\b/i,
  /\byou'?ve been exploring\b/i,
  /\byou'?ve been using\b/i,
  /\byou seem(ed)? to\b/i,
  /\bI (can see|can tell)\b/i,
  /\bit looks like\b/i,
  /\bI noticed that\b/i,
]

export function scanUngroundedClaims(text: string): string[] {
  const warnings: string[] = []
  for (const pattern of UNGROUNDED_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(`⚠ Possible ungrounded claim (pattern: "${pattern.source}") — verify before sending.`)
    }
  }
  return warnings
}

function resolveModel(provider: string, model: string, key: string) {
  switch (provider) {
    case 'openai':    return createOpenAI({ apiKey: key })(model)
    case 'anthropic': return createAnthropic({ apiKey: key })(model)
    case 'groq':      return createGroq({ apiKey: key })(model)
    default:          throw new Error(`Unknown LLM provider: ${provider}`)
  }
}

export async function generateDraftText(factBlock: string, voiceSample: string | null): Promise<string> {
  const key = process.env.CTHRU_LLM_KEY
  if (!key) throw new Error('CTHRU_LLM_KEY is not configured')

  const provider = process.env.CTHRU_LLM_PROVIDER ?? 'anthropic'
  const model = process.env.CTHRU_LLM_MODEL ?? 'claude-haiku-4-5-20251001'

  const voiceInstruction = voiceSample
    ? `Match the tone and phrasing of this sample (style only — do not copy content):\n${voiceSample}`
    : 'Use a brief, friendly, professional tone.'

  const system = [
    'You write short outreach messages for product-led growth founders.',
    'Use ONLY the facts provided. Do not infer, guess, or add any claim not explicitly listed.',
    'Do not mention specific feature names, pages, or behaviours not in the fact block.',
    voiceInstruction,
  ].join('\n')

  const prompt = [
    factBlock,
    '',
    'Task: write a brief, friendly note (3–5 sentences) stating that this team is actively using the product and offering help. No subject line. No sign-off name.',
  ].join('\n')

  const { text } = await generateText({ model: resolveModel(provider, model, key), system, prompt })
  return text.trim()
}

async function withinCooldown(domain: string, cooldownDays: number): Promise<boolean> {
  const { rows } = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM outreach_log
     WHERE domain = $1
       AND actioned_at >= NOW() - ($2 || ' days')::INTERVAL`,
    [domain, cooldownDays]
  )
  return Number(rows[0]?.cnt ?? 0) > 0
}

async function hasPendingDraft(domain: string, triggerRuleId: number): Promise<boolean> {
  const { rows } = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
     FROM outreach_drafts
     WHERE domain = $1 AND trigger_rule_id = $2 AND status = 'pending'`,
    [domain, triggerRuleId]
  )
  return Number(rows[0]?.cnt ?? 0) > 0
}

export interface CreateDraftResult {
  draft: OutreachDraft
  cooldownWarning?: string
}

export async function createManualDraft(domain: string): Promise<CreateDraftResult> {
  const [settings, score, topUsers] = await Promise.all([
    getOutreachSettings(),
    scoreCompany(domain),
    getTopUsers(domain),
  ])

  if (!score) throw new Error(`No score found for domain: ${domain}`)

  const suppressed = await isSuppressed(domain, topUsers[0]?.email)
  if (suppressed) throw new Error('This domain or recipient is on the suppression list.')

  const inCooldown = await withinCooldown(domain, settings.cooldown_days)
  const cooldownWarning = inCooldown
    ? `You contacted ${domain} within the last ${settings.cooldown_days} days.`
    : undefined

  const factBlock = buildFactBlock(score, topUsers)
  const generated = await generateDraftText(factBlock, settings.voice_sample)

  const { rows } = await db.query<OutreachDraft>(
    `INSERT INTO outreach_drafts
       (domain, generated_text, draft_text, fact_block, created_by)
     VALUES ($1, $2, $3, $4, 'manual')
     RETURNING *`,
    [domain, generated, generated, factBlock]
  )
  return { draft: rows[0]!, cooldownWarning }
}

// Called from trigger evaluation — silently does nothing if suppressed or in cooldown.
export async function createTriggeredDraft(
  domain: string,
  triggerRuleId: number,
  score: CompanyScore
): Promise<OutreachDraft | null> {
  const [settings, topUsers] = await Promise.all([
    getOutreachSettings(),
    getTopUsers(domain),
  ])

  const suppressed = await isSuppressed(domain, topUsers[0]?.email)
  if (suppressed) return null

  const inCooldown = await withinCooldown(domain, settings.cooldown_days)
  if (inCooldown) return null

  const alreadyPending = await hasPendingDraft(domain, triggerRuleId)
  if (alreadyPending) return null

  const factBlock = buildFactBlock(score, topUsers)
  const generated = await generateDraftText(factBlock, settings.voice_sample)

  const { rows } = await db.query<OutreachDraft>(
    `INSERT INTO outreach_drafts
       (domain, generated_text, draft_text, fact_block, created_by, trigger_rule_id, triggered_at)
     VALUES ($1, $2, $3, $4, 'trigger', $5, NOW())
     RETURNING *`,
    [domain, generated, generated, factBlock, triggerRuleId]
  )
  return rows[0]!
}

export async function getDraft(id: number): Promise<OutreachDraft | null> {
  const { rows } = await db.query<OutreachDraft>(
    'SELECT * FROM outreach_drafts WHERE id = $1',
    [id]
  )
  return rows[0] ?? null
}

export async function updateDraftText(id: number, text: string): Promise<void> {
  await db.query('UPDATE outreach_drafts SET draft_text = $1 WHERE id = $2', [text, id])
}

export async function listDrafts(status?: 'pending' | 'sent' | 'dismissed'): Promise<OutreachDraft[]> {
  if (status) {
    const { rows } = await db.query<OutreachDraft>(
      `SELECT * FROM outreach_drafts WHERE status = $1 ORDER BY created_at DESC`,
      [status]
    )
    return rows
  }
  const { rows } = await db.query<OutreachDraft>('SELECT * FROM outreach_drafts ORDER BY created_at DESC')
  return rows
}

export async function sendSlack(
  draftId: number,
  recipient: string | null,
  editedText: string
): Promise<void> {
  const [draft, settings] = await Promise.all([getDraft(draftId), getOutreachSettings()])
  if (!draft) throw new Error('Draft not found')
  if (draft.sent_at) throw new Error('ALREADY_SENT')
  if (!settings.slack_webhook_url) throw new Error('Slack webhook not configured')

  const suppressed = await isSuppressed(draft.domain, recipient)
  if (suppressed) throw new Error('This domain or recipient is on the suppression list.')

  const payload = {
    text: recipient ? `*To:* ${recipient}\n\n${editedText}` : editedText,
  }
  const res = await fetch(settings.slack_webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`)

  await db.query(
    `INSERT INTO outreach_log (draft_id, domain, channel, recipient, draft_text_snapshot, created_by, trigger_rule_id)
     VALUES ($1, $2, 'slack', $3, $4, $5, $6)`,
    [draftId, draft.domain, recipient ?? null, editedText, draft.created_by, draft.trigger_rule_id]
  )
  await db.query(
    `UPDATE outreach_drafts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [draftId]
  )
}

export async function recordCopy(
  draftId: number,
  recipient: string | null,
  editedText: string
): Promise<void> {
  const draft = await getDraft(draftId)
  if (!draft) throw new Error('Draft not found')
  if (draft.sent_at) throw new Error('ALREADY_SENT')

  const suppressed = await isSuppressed(draft.domain, recipient)
  if (suppressed) throw new Error('This domain or recipient is on the suppression list.')

  await db.query(
    `INSERT INTO outreach_log (draft_id, domain, channel, recipient, draft_text_snapshot, created_by, trigger_rule_id)
     VALUES ($1, $2, 'clipboard_copied', $3, $4, $5, $6)`,
    [draftId, draft.domain, recipient ?? null, editedText, draft.created_by, draft.trigger_rule_id]
  )
  await db.query(
    `UPDATE outreach_drafts SET status = 'sent', sent_at = NOW() WHERE id = $1`,
    [draftId]
  )
}

export async function dismissDraft(draftId: number): Promise<void> {
  await db.query(
    `UPDATE outreach_drafts SET status = 'dismissed', dismissed_at = NOW() WHERE id = $1`,
    [draftId]
  )
}

export async function listOutreachLog(): Promise<OutreachLogEntry[]> {
  const { rows } = await db.query<OutreachLogEntry>(
    'SELECT * FROM outreach_log ORDER BY actioned_at DESC'
  )
  return rows
}
