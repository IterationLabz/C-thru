'use server'

import { revalidatePath } from 'next/cache'
import { addKeyEvent, deleteKeyEvent } from '@/lib/keyEvents'

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
