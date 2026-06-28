'use server'

import { revalidatePath } from 'next/cache'
import { saveFunnel, deleteFunnel, validateFunnelSteps } from '@/lib/funnelEngine'

export async function saveFunnelAction(formData: FormData): Promise<{ error?: string }> {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const mode = formData.get('mode') === 'company' ? 'company' : 'user'
  const windowDays = Number(formData.get('window_days') ?? 30) || 30
  // Accept either newline-separated textarea (steps_raw) or JSON array (steps)
  const stepsRaw = formData.get('steps_raw') as string | null
  const stepsJson = formData.get('steps') as string | null
  if (!name) return { error: 'Funnel name is required.' }

  let stepNames: string[] = []
  if (stepsRaw) {
    stepNames = stepsRaw.split('\n').map(s => s.trim()).filter(Boolean)
  } else {
    try {
      stepNames = JSON.parse(stepsJson ?? '[]')
    } catch {
      return { error: 'Invalid steps format.' }
    }
  }
  if (stepNames.length < 2) {
    return { error: 'A funnel needs at least 2 steps.' }
  }

  const validation = await validateFunnelSteps(stepNames)
  if (!validation.valid) {
    return { error: `Unknown events: ${validation.unknownEvents.join(', ')}` }
  }

  await saveFunnel(name, mode, windowDays, stepNames.map(n => ({ eventName: n })))
  revalidatePath('/funnels')
  return {}
}

export async function deleteFunnelAction(formData: FormData) {
  const id = Number(formData.get('id'))
  if (!id) return
  await deleteFunnel(id)
  revalidatePath('/funnels')
}
