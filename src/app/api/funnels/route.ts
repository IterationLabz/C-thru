import { NextRequest, NextResponse } from 'next/server'
import { evaluateFunnel, validateFunnelSteps, type FunnelStep } from '@/lib/funnelEngine'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.steps)) {
    return NextResponse.json({ error: 'steps array required' }, { status: 400 })
  }

  const steps: FunnelStep[] = body.steps
  const mode: 'user' | 'company' = body.mode === 'company' ? 'company' : 'user'
  const windowDays = typeof body.windowDays === 'number' ? body.windowDays : 30

  const eventNames = steps.map(s => s.eventName)
  const validation = await validateFunnelSteps(eventNames)
  if (!validation.valid) {
    return NextResponse.json({ error: `Unknown events: ${validation.unknownEvents.join(', ')}` }, { status: 422 })
  }

  const result = await evaluateFunnel({ steps, mode, windowDays })
  return NextResponse.json(result)
}
