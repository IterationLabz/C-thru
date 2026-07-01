import type { Metadata } from 'next'
import { listFunnels, evaluateFunnel } from '@/lib/funnelEngine'
import { saveFunnelAction, deleteFunnelAction } from './actions'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import { EmptyState } from '@/components/States'
import FunnelDropoffChart from '@/components/charts/FunnelDropoffChart'

export const metadata: Metadata = { title: 'Funnels' }
export const dynamic = 'force-dynamic'


const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-ink-3)',
  marginBottom: '0.375rem',
  letterSpacing: '0.02em',
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-line)',
  borderRadius: '8px',
  padding: '0.5625rem 0.875rem',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.875rem',
  color: 'var(--color-ink)',
  background: 'var(--color-card)',
  outline: 'none',
}

export default async function FunnelsPage() {
  const saved = await listFunnels()

  const funnelResults = await Promise.all(
    saved.map(async f => {
      try {
        const result = await evaluateFunnel({ steps: f.steps, mode: f.mode, windowDays: f.windowDays })
        return { funnel: f, result, error: null }
      } catch (e) {
        return { funnel: f, result: null, error: e instanceof Error ? e.message : 'Error' }
      }
    })
  )

  return (
    <AppShell>
      {/* ── Header ── */}
      <div style={{ marginBottom: '2.25rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            marginBottom: '0.25rem',
          }}
        >
          Funnels
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>
          See where users drop off between key events.
        </p>
      </div>

      {/* ── Saved funnels ── */}
      {funnelResults.length === 0 ? (
        <EmptyState
          title="No funnels yet"
          description="Create one below to see how users move through your product."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
            marginBottom: '2.5rem',
          }}
        >
          {funnelResults.map(({ funnel, result, error }) => (
            <Card key={funnel.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)' }}>{funnel.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)', marginTop: '0.125rem' }}>
                    {funnel.mode} · {funnel.windowDays}d · {funnel.steps.length} steps
                  </p>
                </div>
                <form action={deleteFunnelAction}>
                  <input type="hidden" name="id" value={funnel.id} />
                  <button
                    type="submit"
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-red)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Delete
                  </button>
                </form>
              </div>
              {error ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-red)', marginTop: '0.75rem' }}>{error}</p>
              ) : result ? (
                <div style={{ marginTop: '1.25rem' }}>
                  <FunnelDropoffChart steps={result.steps} />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {/* ── New funnel form ── */}
      <div style={{ marginBottom: '0.875rem' }}>
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-3)',
          }}
        >
          New funnel
        </p>
      </div>
      <Card>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form action={saveFunnelAction as any} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
          <div>
            <label style={labelStyle}>Funnel name</label>
            <input
              name="name"
              required
              placeholder="e.g. Onboarding flow"
              style={fieldStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label style={labelStyle}>Mode</label>
              <select name="mode" style={fieldStyle}>
                <option value="user">By user</option>
                <option value="company">By company</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Window (days)</label>
              <input
                name="window_days"
                type="number"
                min="1"
                defaultValue="30"
                style={fieldStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Steps — one event name per line (min 2)</label>
            <textarea
              name="steps_raw"
              rows={5}
              placeholder={'signup\nactivate\npayment_intent'}
              style={{ ...fieldStyle, fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', resize: 'vertical' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '0.375rem' }}>
              Enter event names exactly as they appear in your data.
            </p>
          </div>

          <div>
            <button
              type="submit"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#fff',
                background: 'var(--color-accent)',
                border: 'none',
                padding: '0.5625rem 1.25rem',
                borderRadius: '10px',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
              }}
            >
              Save funnel
            </button>
          </div>
        </form>
      </Card>
    </AppShell>
  )
}
