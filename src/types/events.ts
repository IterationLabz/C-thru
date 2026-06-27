export type EventSource = 'auto' | 'custom' | 'server'

export interface RawEvent {
  name: string
  source: EventSource
  anonymousId?: string
  occurredAt: string // ISO 8601
  properties?: Record<string, unknown>
  userId?: string
  email?: string
  sessionId?: string
  url?: string
  referrer?: string
  device?: Record<string, unknown>
}
