import { describe, it, expect } from 'vitest'
import { getSchemaContext } from '../schemaContext'

describe('getSchemaContext', () => {
  it('returns a string mentioning all four allowed views', async () => {
    const ctx = await getSchemaContext()
    expect(ctx).toContain('signups_v')
    expect(ctx).toContain('active_users_v')
    expect(ctx).toContain('company_activity_v')
    expect(ctx).toContain('events_v')
  })

  it('includes actual column names from the DB', async () => {
    const ctx = await getSchemaContext()
    // signups_v
    expect(ctx).toContain('signed_up_at')
    expect(ctx).toContain('company_domain')
    // active_users_v
    expect(ctx).toContain('last_event_at')
    expect(ctx).toContain('total_events')
    // company_activity_v
    expect(ctx).toContain('identified_users')
    expect(ctx).toContain('unique_visitors')
    // events_v
    expect(ctx).toContain('received_at')
    expect(ctx).toContain('occurred_at_effective')
  })

  it('includes semantic annotations on key columns', async () => {
    const ctx = await getSchemaContext()
    expect(ctx).toMatch(/signed_up_at.*--/)
    expect(ctx).toMatch(/received_at.*server receipt time/)
    expect(ctx).toMatch(/company_domain.*NULL for personal/)
    expect(ctx).toMatch(/identified_users.*anonymous-only excluded/)
  })

  it('is under 2000 characters (token budget)', async () => {
    const ctx = await getSchemaContext()
    expect(ctx.length).toBeLessThan(2000)
  })

  it('lists views in the order: signups_v, active_users_v, company_activity_v, events_v', async () => {
    const ctx = await getSchemaContext()
    const positions = [
      ctx.indexOf('signups_v'),
      ctx.indexOf('active_users_v'),
      ctx.indexOf('company_activity_v'),
      ctx.indexOf('events_v'),
    ]
    expect(positions[0]).toBeLessThan(positions[1]!)
    expect(positions[1]).toBeLessThan(positions[2]!)
    expect(positions[2]).toBeLessThan(positions[3]!)
  })
})
