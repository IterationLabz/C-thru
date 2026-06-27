'use server'

import { revalidatePath } from 'next/cache'
import { addKeyEvent, deleteKeyEvent } from '@/lib/keyEvents'
import { addBlockedDomain, removeBlockedDomain } from '@/lib/blockedDomains'

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
