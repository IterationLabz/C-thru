'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createManualDraft,
  dismissDraft,
  sendSlack,
  recordCopy,
  updateDraftText,
} from '@/lib/outreachDraft'

export async function generateDraftAction(formData: FormData): Promise<{ error?: string; warning?: string }> {
  const domain = (formData.get('domain') as string | null)?.trim() ?? ''
  if (!domain) return { error: 'Domain is required.' }

  try {
    const { draft, cooldownWarning } = await createManualDraft(domain)
    revalidatePath('/outreach')
    if (cooldownWarning) {
      redirect(`/outreach/${draft.id}?warning=${encodeURIComponent(cooldownWarning)}`)
    }
    redirect(`/outreach/${draft.id}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('NEXT_REDIRECT')) throw e
    return { error: msg }
  }
}

export async function dismissDraftAction(formData: FormData): Promise<void> {
  const id = Number(formData.get('draft_id'))
  if (!id) return
  await dismissDraft(id)
  revalidatePath('/outreach')
  redirect('/outreach')
}

export async function sendSlackAction(formData: FormData): Promise<{ error?: string }> {
  const draftId = Number(formData.get('draft_id'))
  const recipient = (formData.get('recipient') as string | null)?.trim() || null
  const text = (formData.get('draft_text') as string | null) ?? ''
  if (!draftId) return { error: 'Missing draft ID.' }

  try {
    await sendSlack(draftId, recipient, text)
    revalidatePath('/outreach')
    redirect('/outreach')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('NEXT_REDIRECT')) throw e
    if (msg === 'ALREADY_SENT') return { error: 'This draft was already sent.' }
    return { error: msg }
  }
}

export async function recordCopyAction(formData: FormData): Promise<{ error?: string }> {
  const draftId = Number(formData.get('draft_id'))
  const recipient = (formData.get('recipient') as string | null)?.trim() || null
  const text = (formData.get('draft_text') as string | null) ?? ''
  if (!draftId) return { error: 'Missing draft ID.' }

  try {
    await recordCopy(draftId, recipient, text)
    revalidatePath('/outreach')
    redirect('/outreach')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('NEXT_REDIRECT')) throw e
    if (msg === 'ALREADY_SENT') return { error: 'This draft was already sent.' }
    return { error: msg }
  }
}

export async function saveDraftTextAction(formData: FormData): Promise<void> {
  const draftId = Number(formData.get('draft_id'))
  const text = (formData.get('draft_text') as string | null) ?? ''
  if (!draftId) return
  await updateDraftText(draftId, text)
  revalidatePath(`/outreach/${draftId}`)
}
