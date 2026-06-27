export interface CthruOptions {
  host: string
  serverKey: string
}

export interface ServerEventProperties {
  userId?: string
  email?: string
  [key: string]: unknown
}

export class Cthru {
  private host: string
  private serverKey: string

  constructor(options: CthruOptions) {
    this.host = options.host.replace(/\/$/, '')
    this.serverKey = options.serverKey
  }

  async trackServer(name: string, properties: ServerEventProperties = {}): Promise<void> {
    const { userId, email, ...rest } = properties

    if (!userId && !email) {
      throw new Error('trackServer requires userId or email in properties')
    }

    const event = {
      name,
      source: 'server' as const,
      occurredAt: new Date().toISOString(),
      userId: userId as string | undefined,
      email: email as string | undefined,
      properties: rest,
    }

    const response = await fetch(`${this.host}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverKey: this.serverKey, events: [event] }),
    })

    if (!response.ok) {
      throw new Error(`C-thru ingestion failed: ${response.status}`)
    }

    const results = await response.json() as Array<{ accepted: boolean; reason?: string }>
    if (results[0] && !results[0].accepted) {
      throw new Error(`Event rejected: ${results[0].reason ?? 'unknown reason'}`)
    }
  }
}
