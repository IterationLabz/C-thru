'use server'

import { revalidatePath } from 'next/cache'
import { addKeyEvent, deleteKeyEvent } from '@/lib/keyEvents'
import { addBlockedDomain, removeBlockedDomain } from '@/lib/blockedDomains'
import { saveLlmConfig, verifyLlmKey } from '@/lib/llmSettings'
import { createRule, deleteRule, type SignalType } from '@/lib/readinessEngine'
import { saveOutreachSettings, saveVoiceSample, deleteVoiceSample } from '@/lib/outreachDraft'
import { createTriggerRule, deleteTriggerRule } from '@/lib/triggerEngine'
import { addSuppression, removeSuppression } from '@/lib/suppressionList'

const VALID_SIGNALS: SignalType[] = [
  'active_users', 'total_events', 'days_since_active', 'key_event_fired', 'days_in_product',
]

export async function addRuleAction(formData: FormData) {
  const signal = formData.get('signal') as string
  if (!VALID_SIGNALS.includes(signal as SignalType)) return
  const label     = (formData.get('label')      as string | null)?.trim() ?? ''
  const operator  = (formData.get('operator')   as string) === '<=' ? '<=' : '>='
  const threshold = Number(formData.get('threshold'))
  const windowDays = formData.get('window_days') ? Number(formData.get('window_days')) : null
  const eventName  = (formData.get('event_name') as string | null)?.trim() || null
  if (!label || isNaN(threshold)) return
  await createRule({ label, signal: signal as SignalType, operator, threshold, window_days: windowDays, event_name: eventName })
  revalidatePath('/settings')
  revalidatePath('/accounts')
}

export async function deleteRuleAction(formData: FormData) {
  const id = Number(formData.get('id'))
  if (!id) return
  await deleteRule(id)
  revalidatePath('/settings')
  revalidatePath('/accounts')
}

export async function addKeyEventAction(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (!name) return
  await addKeyEvent(name)
  revalidatePath('/settings')
}

export async function deleteKeyEventAction(formData: FormData) {
  const name = formData.get('name') as string
  if (!name) return
  await deleteKeyEvent(name)
  revalidatePath('/settings')
}

export async function addBlockedDomainAction(formData: FormData) {
  const domain = (formData.get('domain') as string | null)?.trim() ?? ''
  if (!domain) return
  await addBlockedDomain(domain)
  revalidatePath('/settings')
}

export async function removeBlockedDomainAction(formData: FormData) {
  const domain = formData.get('domain') as string
  if (!domain) return
  await removeBlockedDomain(domain)
  revalidatePath('/settings')
}

export async function saveLlmConfigAction(formData: FormData) {
  const key      = (formData.get('llm_key')      as string | null)?.trim() ?? ''
  const provider = (formData.get('llm_provider')  as string | null)?.trim() ?? 'anthropic'
  const model    = (formData.get('llm_model')     as string | null)?.trim() ?? 'claude-haiku-4-5-20251001'
  if (!key) return
  await saveLlmConfig(key, provider, model)
  revalidatePath('/settings')
}

export async function verifyLlmKeyAction(): Promise<{ ok: boolean; error?: string }> {
  return verifyLlmKey()
}

export async function saveOutreachSettingsAction(formData: FormData): Promise<void> {
  const cooldownRaw = formData.get('cooldown_days')
  const webhookRaw  = formData.get('slack_webhook_url') as string | null
  const cooldown = cooldownRaw ? Number(cooldownRaw) : undefined
  await saveOutreachSettings({
    cooldown_days: cooldown && !isNaN(cooldown) && cooldown > 0 ? cooldown : undefined,
    slack_webhook_url: webhookRaw !== null ? webhookRaw : undefined,
  })
  revalidatePath('/settings')
}

export async function saveVoiceSampleAction(formData: FormData): Promise<void> {
  const sample = (formData.get('voice_sample') as string | null) ?? ''
  await saveVoiceSample(sample)
  revalidatePath('/settings')
}

export async function deleteVoiceSampleAction(): Promise<void> {
  await deleteVoiceSample()
  revalidatePath('/settings')
}

export async function addTriggerRuleAction(formData: FormData): Promise<void> {
  const label     = (formData.get('label') as string | null)?.trim() ?? ''
  const rulesMet  = Number(formData.get('rules_met_min'))
  const rulesTotal = Number(formData.get('rules_total'))
  if (!label || isNaN(rulesMet) || isNaN(rulesTotal) || rulesMet < 1 || rulesTotal < rulesMet) return
  await createTriggerRule(label, rulesMet, rulesTotal)
  revalidatePath('/settings')
}

export async function deleteTriggerRuleAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  if (!id) return
  await deleteTriggerRule(id)
  revalidatePath('/settings')
}

export async function addSuppressionAction(formData: FormData): Promise<void> {
  const type  = formData.get('entry_type') as 'domain' | 'email'
  const value = (formData.get('value') as string | null)?.trim() ?? ''
  if (!value || !['domain', 'email'].includes(type)) return
  await addSuppression(type, value)
  revalidatePath('/settings')
}

export async function removeSuppressionAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('id'))
  if (!id) return
  await removeSuppression(id)
  revalidatePath('/settings')
}
