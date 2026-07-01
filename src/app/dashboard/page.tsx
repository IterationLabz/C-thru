import Link from 'next/link'
import { getActiveUsers, getNewSignups, getTopEvents, getLiveCount, getTopCompanies, formatDomain } from '@/lib/dashboardQueries'
import { listPinnedQueries } from '@/lib/pinnedQueries'
import { validateAndRun, QueryResult } from '@/lib/sqlGuard'
import { unpinQueryAction } from '@/app/ask/actions'
import AppShell from '@/components/AppShell'
import MetricCard from '@/components/MetricCard'
import Card from '@/components/Card'
import { BarChartPlaceholder, HorizontalBarPlaceholder, ScoreBar } from '@/components/ChartPlaceholder'
import { EmptyState } from '@/components/States'

export const dynamic = 'force-dynamic'

/* ── Freshness dot for last-active column ── */
function FreshnessDot({ daysAgo }: { daysAgo: number }) {
  const color = daysAgo <= 1 ? 'var(--color-green)' : daysAgo <= 7 ? 'var(--color-amber)' : 'var(--color-ink-3)'
  return (
    <span
      style={{
        display: 'inline-block',
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: color,
        marginRight: '0.4rem',
        verticalAlign: 'middle',
      }}
    />
  )
}

/* ── Section heading ── */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--color-ink-3)',
        marginBottom: '1rem',
      }}
    >
      {children}
    </h2>
  )
}

export default async function DashboardPage() {
  const pinnedQueries = await listPinnedQueries()

  const pinnedResults = await Promise.all(
    pinnedQueries.map(async (pq) => {
      try {
        const result = await validateAndRun(pq.sql)
        return { pq, result, error: null }
      } catch (e) {
        return { pq, result: null as QueryResult | null, error: e instanceof Error ? e.message : 'Error' }
      }
    })
  )

  const [activeUsers, newSignups, topEvents, liveCount, topCompanies] = await Promise.all([
    getActiveUsers(),
    getNewSignups(),
    getTopEvents(),
    getLiveCount(),
    getTopCompanies(),
  ])

  const topEventsForChart = topEvents.slice(0, 8).map(e => ({ label: e.name, value: e.count }))

  return (
    <AppShell>
      {/* ── Page title ── */}
      <div style={{ marginBottom: '2.25rem' }}>
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
          <span style={{ fontStyle: 'italic', color: 'var(--color-ink-2)' }}>C-thru</span> <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</span>
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>
          Product activity at a glance.
        </p>
      </div>

      {/* ── Metric cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        <MetricCard
          label="Active users · 7d"
          value={activeUsers.last7}
          sub="identified, ≥1 event"
          trend={{ direction: 'up', label: '12%' }}
        />
        <MetricCard
          label="Active users · 30d"
          value={activeUsers.last30}
          sub="identified users with ≥1 event"
        />
        <MetricCard
          label="New signups · 7d"
          value={newSignups.last7}
          sub={`${newSignups.last30} in last 30 days`}
          trend={{ direction: 'up', label: '8%' }}
        />
        <MetricCard
          label="Live · last 60s"
          value={liveCount}
          sub="events ingested"
          live
        />
      </div>

      {/* ── Charts row ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: '1rem',
          marginBottom: '2.5rem',
          alignItems: 'start',
        }}
        className="charts-row"
      >
        <Card>
          <BarChartPlaceholder label="Events over time" />
        </Card>

        <Card>
          <SectionHeading>Top events</SectionHeading>
          {topEvents.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>No events recorded yet.</p>
          ) : (
            <HorizontalBarPlaceholder items={topEventsForChart} />
          )}
        </Card>
      </div>

      {/* ── Companies table ── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <SectionHeading>Companies</SectionHeading>
          <Link
            href="/accounts"
            style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
          >
            View all accounts →
          </Link>
        </div>

        {topCompanies.length === 0 ? (
          <EmptyState
            title="No company events yet"
            description="Events from users with work email domains will appear here once they're ingested."
          />
        ) : (
          <Card padding="0">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                  {['Company', 'Domain', 'Events · 7d', 'Readiness'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === 'Events · 7d' || h === 'Readiness' ? 'right' : 'left',
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
                {topCompanies.map((c, i) => (
                  <tr
                    key={c.domain}
                    style={{
                      borderBottom: i < topCompanies.length - 1 ? '1px solid var(--color-line)' : 'none',
                    }}
                  >
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Logo placeholder */}
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '7px',
                            background: 'var(--color-paper-2)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            color: 'var(--color-ink-2)',
                            flexShrink: 0,
                          }}
                        >
                          {formatDomain(c.domain).charAt(0).toUpperCase()}
                        </span>
                        <Link
                          href={`/accounts/${c.domain}`}
                          style={{ fontWeight: 600, color: 'var(--color-ink)', textDecoration: 'none' }}
                        >
                          {formatDomain(c.domain)}
                        </Link>
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                        {c.domain}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem' }}>
                        <FreshnessDot daysAgo={1} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                          {c.eventCount.toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <ScoreBar met={3} total={5} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* ── Pinned queries ── */}
      {pinnedResults.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <SectionHeading>Pinned queries</SectionHeading>
            <Link
              href="/ask"
              style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
            >
              Ask a question →
            </Link>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            {pinnedResults.map(({ pq, result, error }) => (
              <Card key={pq.id}>
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--color-ink-2)',
                    marginBottom: '0.75rem',
                    lineHeight: 1.45,
                  }}
                >
                  {pq.question}
                </p>
                {error ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-red)' }}>{error}</p>
                ) : result && result.rows.length === 1 && Object.keys(result.rows[0]!).length === 1 ? (
                  <p
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '2.25rem',
                      fontWeight: 500,
                      letterSpacing: '-0.02em',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {String(Object.values(result.rows[0]!)[0])}
                  </p>
                ) : result ? (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)' }}>
                    {result.rowCount} row{result.rowCount === 1 ? '' : 's'}
                  </p>
                ) : null}
                <form action={unpinQueryAction.bind(null, pq.id)} style={{ marginTop: '0.875rem' }}>
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
                    Unpin
                  </button>
                </form>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Mobile charts layout fix ── */}
      <style>{`
        @media (max-width: 768px) {
          .charts-row { grid-template-columns: 1fr !important; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </AppShell>
  )
}
