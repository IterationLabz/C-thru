'use server'

import { revalidatePath } from 'next/cache'
import { addKeyEvent, deleteKeyEvent } from '@/lib/keyEvents'
import { addBlockedDomain, removeBlockedDomain } from '@/lib/blockedDomains'
import { saveLlmConfig, verifyLlmKey } from '@/lib/llmSettings'

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
