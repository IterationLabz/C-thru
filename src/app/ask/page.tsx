import type { Metadata } from 'next'
import { getLlmKeyHint } from '@/lib/llmSettings'
import { listPinnedQueries } from '@/lib/pinnedQueries'
import { validateAndRun } from '@/lib/sqlGuard'
import { AskForm } from './AskForm'
import AppShell from '@/components/AppShell'
import Card from '@/components/Card'
import { EmptyState } from '@/components/States'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Ask' }
export const dynamic = 'force-dynamic'

export default async function AskPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q : ''
  const hasLlmKey = Boolean(getLlmKeyHint())
  const pinned = await listPinnedQueries()

  const pinnedWithValues = await Promise.all(
    pinned.map(async pq => {
      try {
        const result = await validateAndRun(pq.sql)
        return { pq, result, error: null }
      } catch (e) {
        return { pq, result: null, error: e instanceof Error ? e.message : 'Error' }
      }
    })
  )

  return (
    <AppShell maxWidth="52rem">
      {/* ── Page header ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2rem',
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            marginBottom: '0.375rem',
          }}
        >
          Ask
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-ink-3)', lineHeight: 1.5 }}>
          Ask in plain English — C-thru generates the SQL, shows it to you, then runs it.
          Only <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', background: 'var(--color-paper-2)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>SELECT</code> queries are allowed.
        </p>
      </div>

      {/* ── Ask form (client component) ── */}
      <Card style={{ marginBottom: '2.5rem' }}>
        <AskForm hasLlmKey={hasLlmKey} initialQuestion={q} />
      </Card>

      {/* ── Pinned queries ── */}
      {pinnedWithValues.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <p
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'var(--color-ink-3)',
              }}
            >
              Pinned queries
            </p>
            <Link href="/" style={{ fontSize: '0.8125rem', color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
              View on dashboard →
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {pinnedWithValues.map(({ pq, result, error }) => (
              <Link key={pq.id} href={`/ask?q=${encodeURIComponent(pq.question)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Card>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-2)', marginBottom: '0.75rem', lineHeight: 1.45 }}>
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
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {pinnedWithValues.length === 0 && (
        <EmptyState
          title="No pinned queries yet"
          description="Ask a question and click 'Pin to dashboard' to save it here."
        />
      )}
    </AppShell>
  )
}
