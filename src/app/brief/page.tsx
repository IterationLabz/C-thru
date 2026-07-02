import Link from 'next/link'
import type { Metadata } from 'next'
import { collectBriefFacts, generateBriefSentence } from '@/lib/briefGenerator'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import { EmptyState } from '@/components/States'

export const metadata: Metadata = { title: 'Morning brief' }
export const dynamic = 'force-dynamic'

export default async function BriefPage() {
  const facts = await collectBriefFacts()
  const brief = generateBriefSentence(facts)

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <AppShell maxWidth="52rem">
      {/* ── Header ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <p
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
            marginBottom: '0.5rem',
          }}
        >
          Morning brief
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
          }}
        >
          {today}
        </h1>
      </div>

      {/* ── Summary sentence ── */}
      <Card style={{ marginBottom: '2rem', background: 'var(--color-paper-2)', boxShadow: 'none' }}>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.1875rem',
            fontWeight: 400,
            fontStyle: 'italic',
            color: 'var(--color-ink)',
            lineHeight: 1.55,
            marginBottom: '0.75rem',
          }}
        >
          {brief}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>
          Generated {new Date(facts.generatedAt).toLocaleString()} · deterministic, no AI
        </p>
      </Card>

      {/* ── Metric strip ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        {[
          { label: 'Active users · 7d', value: facts.activeUsers7d },
          { label: 'Active users · 30d', value: facts.activeUsers30d },
          { label: 'New signups · 7d', value: facts.newSignups7d },
        ].map(({ label, value }) => (
          <Link href="/journey" key={label} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <Card style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  fontWeight: 500,
                  letterSpacing: '-0.03em',
                  color: 'var(--color-ink)',
                  lineHeight: 1,
                  marginBottom: '0.375rem',
                }}
              >
                {value}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>{label}</p>
            </Card>
          </Link>
        ))}
      </div>

      {/* ── Top account ── */}
      {facts.topCompany && facts.topCompanyScore && (
        <section style={{ marginBottom: '2rem' }}>
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
            Top account
          </p>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-ink)', marginBottom: '0.25rem' }}>
                  <Link href={`/accounts/${facts.topCompany}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {facts.topCompany}
                  </Link>
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
                  {facts.topCompanyScore.rulesMet}/{facts.topCompanyScore.rulesTotal} readiness rules met
                </p>
              </div>
              <Link
                href={`/accounts/${facts.topCompany}`}
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--color-accent)',
                  textDecoration: 'none',
                }}
              >
                View account →
              </Link>
            </div>
          </Card>
        </section>
      )}

      {/* ── Most active users ── */}
      {facts.topUsers.length > 0 ? (
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
            Most active this week
          </p>
          <Card padding="0">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                  {['User', 'Events this week'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        textAlign: i === 0 ? 'left' : 'right',
                        padding: '0.75rem 1.25rem',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--color-ink-3)',
                        background: 'var(--color-paper-2)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facts.topUsers.map((u, i) => (
                  <tr
                    key={u.userId}
                    style={{ borderBottom: i < facts.topUsers.length - 1 ? '1px solid var(--color-line)' : 'none' }}
                  >
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--color-ink)' }}>
                      <Link href={`/journey/${u.userId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {u.email ?? (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                            {u.userId}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td
                      style={{
                        padding: '0.875rem 1.25rem',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.8125rem',
                        color: 'var(--color-ink-2)',
                      }}
                    >
                      {u.eventCount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ) : (
        <EmptyState
          title="No active users this week"
          description="Data will appear here once events start flowing in."
        />
      )}
    </AppShell>
  )
}
