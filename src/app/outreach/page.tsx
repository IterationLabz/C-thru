import Link from 'next/link'
import type { Metadata } from 'next'
import { scoreAllCompanies } from '@/lib/readinessEngine'
import { evaluateTriggers } from '@/lib/triggerEngine'
import { listDrafts } from '@/lib/outreachDraft'
import { dismissDraftAction } from './actions'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import Badge from '@/components/Badge'
import { ScoreBar } from '@/components/ChartPlaceholder'
import { EmptyState } from '@/components/States'

export const metadata: Metadata = { title: 'Outreach' }
export const dynamic = 'force-dynamic'

function displayName(domain: string): string {
  const stripped = domain.replace(/\.(com|io|co|net|org|ai|app|dev|so|xyz)$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export default async function OutreachPage() {
  const scores = await scoreAllCompanies()
  await evaluateTriggers(scores)

  const scoreMap = new Map(scores.map(s => [s.domain, s]))
  const [pending, sent, dismissed] = await Promise.all([
    listDrafts('pending'),
    listDrafts('sent'),
    listDrafts('dismissed'),
  ])

  const history = [...sent, ...dismissed].sort(
    (a, b) => (b.created_at as unknown as number) - (a.created_at as unknown as number)
  )

  const pendingSorted = [...pending].sort((a, b) => {
    const sa = scoreMap.get(a.domain)
    const sb = scoreMap.get(b.domain)
    const ra = sa ? sa.rulesMet / sa.rulesTotal : 0
    const rb = sb ? sb.rulesMet / sb.rulesTotal : 0
    return rb - ra
  })

  return (
    <AppShell maxWidth="52rem">
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
          Outreach
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>
          Drafts ready for your review. C-thru never sends automatically.
        </p>
      </div>

      {/* ── Pending queue ── */}
      <section style={{ marginBottom: '3rem' }}>
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-3)',
            marginBottom: '0.875rem',
          }}
        >
          Queue · {pendingSorted.length} pending
        </p>

        {pendingSorted.length === 0 ? (
          <EmptyState
            title="No pending drafts"
            description="Go to an account and click 'Draft outreach', or add trigger rules in Settings."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingSorted.map(draft => {
              const score = scoreMap.get(draft.domain)
              return (
                <Card key={draft.id}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <Link
                          href={`/outreach/${draft.id}`}
                          style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-ink)', textDecoration: 'none' }}
                        >
                          {displayName(draft.domain)}
                        </Link>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                          {draft.domain}
                        </span>
                        {draft.created_by === 'trigger' && <Badge color="accent">Triggered</Badge>}
                      </div>
                      {score && (
                        <Link href={`/accounts/${draft.domain}`} style={{ textDecoration: 'none', display: 'block', marginTop: '0.25rem' }}>
                          <ScoreBar met={score.rulesMet} total={score.rulesTotal} />
                        </Link>
                      )}
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--color-ink-3)',
                          marginTop: '0.625rem',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          lineHeight: 1.5,
                        }}
                      >
                        {draft.draft_text.slice(0, 160)}…
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                      <Link
                        href={`/outreach/${draft.id}`}
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          color: '#fff',
                          background: 'var(--color-accent)',
                          padding: '0.4375rem 0.875rem',
                          borderRadius: '10px',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Review →
                      </Link>
                      <form action={dismissDraftAction}>
                        <input type="hidden" name="draft_id" value={draft.id} />
                        <button
                          type="submit"
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--color-ink-3)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Dismiss
                        </button>
                      </form>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── History ── */}
      {history.length > 0 && (
        <section>
          <p
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-3)',
              marginBottom: '0.875rem',
            }}
          >
            History
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {history.map(draft => (
              <div
                key={draft.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-line)',
                  borderRadius: '10px',
                  padding: '0.75rem 1.125rem',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {draft.status === 'sent' ? (
                    <span style={{ fontSize: '0.875rem' }}>↗</span>
                  ) : (
                    <span style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>✕</span>
                  )}
                  <div>
                    <Link href={`/accounts/${draft.domain}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-ink)' }}>
                        {displayName(draft.domain)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)', marginLeft: '0.5rem' }}>
                        {draft.domain}
                      </span>
                    </Link>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <Badge color={draft.status === 'sent' ? 'green' : 'neutral'}>
                    {draft.status === 'sent' ? 'Sent / copied' : 'Dismissed'}
                  </Badge>
                  <Link
                    href={`/outreach/${draft.id}`}
                    style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
                  >
                    View →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  )
}
