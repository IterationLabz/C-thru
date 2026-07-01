import Link from 'next/link'
import type { Metadata } from 'next'
import { scoreAllCompanies } from '@/lib/readinessEngine'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import { ScoreBar } from '@/components/ChartPlaceholder'
import ReadinessBarChart from '@/components/charts/ReadinessBarChart'
import { EmptyState } from '@/components/States'

export const metadata: Metadata = { title: 'Accounts' }
export const dynamic = 'force-dynamic'

function displayName(domain: string): string {
  const stripped = domain.replace(/\.(com|io|co|net|org|ai|app|dev|so|xyz)$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export default async function AccountsPage() {
  const scores = await scoreAllCompanies()
  const chartItems = scores.map(s => ({
    domain: s.domain,
    label: displayName(s.domain),
    met: s.rulesMet,
    total: s.rulesTotal
  }))

  return (
    <AppShell maxWidth="60rem">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.25rem' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.5rem',
              fontWeight: 400,
              lineHeight: 1.1,
              color: 'var(--color-ink)',
              marginBottom: '0.5rem',
            }}
          >
            <span style={{ fontStyle: 'italic', color: 'var(--color-ink-2)' }}>All</span> <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '-0.02em' }}>Accounts</span>
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>
            Ranked by readiness to convert.
          </p>
        </div>
        <Link
          href="/settings"
          style={{
            fontSize: '0.8125rem',
            color: 'var(--color-ink-2)',
            textDecoration: 'none',
            fontWeight: 500,
            marginTop: '0.375rem',
          }}
        >
          Edit rules →
        </Link>
      </div>

      {scores.length === 0 ? (
        <EmptyState
          title="No company data yet"
          description="Events with company email domains will appear here once they're ingested."
        />
      ) : (
        <>
          <section style={{ marginBottom: '2.5rem' }}>
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
              Readiness by account
            </p>
            <Card padding="1.5rem">
              <ReadinessBarChart items={chartItems} />
            </Card>
          </section>

          <Card padding="0">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                  {['Company', 'Readiness', 'Domain', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        textAlign: i < 2 ? 'left' : i === 2 ? 'left' : 'right',
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
                {scores.map((s, i) => (
                  <tr
                    key={s.domain}
                    style={{
                      borderBottom: i < scores.length - 1 ? '1px solid var(--color-line)' : 'none',
                    }}
                  >
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            background: 'var(--color-paper-2)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--color-ink-2)',
                            flexShrink: 0,
                          }}
                        >
                          {displayName(s.domain).charAt(0)}
                        </span>
                        <Link
                          href={`/accounts/${s.domain}`}
                          style={{ fontWeight: 600, color: 'var(--color-ink)', textDecoration: 'none' }}
                        >
                          {displayName(s.domain)}
                        </Link>
                      </div>
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <ScoreBar met={s.rulesMet} total={s.rulesTotal} />
                    </td>
                    <td style={{ padding: '1rem 1.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                        {s.domain}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                      <Link
                        href={`/accounts/${s.domain}`}
                        style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        Details →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '0.875rem', fontFamily: 'var(--font-mono)' }}>
            {scores.length} {scores.length === 1 ? 'company' : 'companies'} · scores computed live
          </p>
        </>
      )}
    </AppShell>
  )
}
