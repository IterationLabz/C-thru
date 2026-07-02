import Link from 'next/link'
import type { Metadata } from 'next'
import { listUsersForJourney } from '@/lib/journeyEngine'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import { EmptyState } from '@/components/States'

export const metadata: Metadata = { title: 'Journey' }
export const dynamic = 'force-dynamic'

export default async function JourneyIndexPage() {
  const users = await listUsersForJourney(50)

  return (
    <AppShell maxWidth="56rem">
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
          Journey
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)' }}>
          Step-by-step timeline for any identified user.
        </p>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="No identified users yet"
          description="Users appear here once they've called cthru.identify()."
        />
      ) : (
        <Card padding="0">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-line)' }}>
                {['User', 'Events', 'Last active', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: i === 0 ? 'left' : i === 3 ? 'right' : 'right',
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
              {users.map((u, i) => (
                <tr
                  key={u.userId}
                  style={{ borderBottom: i < users.length - 1 ? '1px solid var(--color-line)' : 'none' }}
                >
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--color-ink)', fontWeight: 500 }}>
                    <Link href={`/journey/${encodeURIComponent(u.userId)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {u.email ?? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                          {u.userId}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--color-ink-2)' }}>
                    <Link href={`/journey/${encodeURIComponent(u.userId)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {u.eventCount}
                    </Link>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                    {new Date(u.lastEventAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                    <Link
                      href={`/journey/${encodeURIComponent(u.userId)}`}
                      style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  )
}
