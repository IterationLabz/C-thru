'use client'

import { useState, useTransition, useEffect } from 'react'
import type { AskResult } from '@/lib/ask'
import type { Trend } from '@/lib/trendComputer'
import { pinQueryAction } from './actions'
import { TrendChip } from '@/components/MetricCard'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: AskResult }
  | { status: 'error'; message: string }

function isSingleAggregate(rows: Record<string, unknown>[]): boolean {
  return rows.length === 1 && Object.keys(rows[0]!).length === 1
}

function toTrendChipDir(direction: Trend['direction']): 'up' | 'down' | 'flat' {
  if (direction === 'up') return 'up'
  if (direction === 'down') return 'down'
  return 'flat'
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = Object.keys(rows[0]!)
  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid var(--color-line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-line)', background: 'var(--color-paper-2)' }}>
            {cols.map(c => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  padding: '0.625rem 1rem',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--color-ink-3)',
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--color-line)' : 'none' }}
            >
              {cols.map(c => (
                <td
                  key={c}
                  style={{
                    padding: '0.625rem 1rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: row[c] == null ? 'var(--color-ink-3)' : 'var(--color-ink-2)',
                  }}
                >
                  {row[c] == null ? 'null' : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--color-line)',
  borderRadius: '10px',
  padding: '0.875rem 1rem',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.9375rem',
  color: 'var(--color-ink)',
  background: 'var(--color-paper)',
  resize: 'none',
  outline: 'none',
  lineHeight: 1.55,
}

export function AskForm({ hasLlmKey, initialQuestion = '' }: { hasLlmKey: boolean, initialQuestion?: string }) {
  const [question, setQuestion] = useState(initialQuestion)
  const [state, setState] = useState<State>({ status: 'idle' })
  const [isPending, startTransition] = useTransition()
  const [pinned, setPinned] = useState(false)
  const [sqlOpen, setSqlOpen] = useState(false)

  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion)
    }
  }, [initialQuestion])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setState({ status: 'loading' })
    setSqlOpen(false)
    startTransition(async () => {
      try {
        setPinned(false)
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        })
        const data = await res.json()
        if (!res.ok) {
          setState({ status: 'error', message: data.error ?? 'Unknown error' })
        } else {
          setState({ status: 'success', result: data as AskResult })
        }
      } catch (e) {
        setState({ status: 'error', message: e instanceof Error ? e.message : 'Network error' })
      }
    })
  }

  const loading = state.status === 'loading' || isPending

  return (
    <div>
      {/* ── Search input ── */}
      {!hasLlmKey && (
        <div
          style={{
            background: 'rgba(180,121,31,0.08)',
            border: '1px solid rgba(180,121,31,0.25)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            fontSize: '0.8125rem',
            color: 'var(--color-amber)',
            marginBottom: '1rem',
          }}
        >
          No LLM key configured.{' '}
          <a href="/settings" style={{ color: 'var(--color-amber)', fontWeight: 600 }}>Add one in Settings →</a>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask anything — e.g. 'how many signups last week?'"
          rows={3}
          disabled={loading || !hasLlmKey}
          style={{
            ...inputStyle,
            marginBottom: '0.875rem',
            opacity: (!hasLlmKey || loading) ? 0.5 : 1,
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim() || !hasLlmKey}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#fff',
            background: 'var(--color-accent)',
            border: 'none',
            padding: '0.5625rem 1.25rem',
            borderRadius: '10px',
            cursor: loading || !question.trim() || !hasLlmKey ? 'not-allowed' : 'pointer',
            opacity: loading || !question.trim() || !hasLlmKey ? 0.45 : 1,
            letterSpacing: '-0.01em',
          }}
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {/* ── Error ── */}
      {state.status === 'error' && (
        <div
          style={{
            background: 'rgba(163,70,47,0.06)',
            border: '1px solid rgba(163,70,47,0.2)',
            borderRadius: '10px',
            padding: '0.875rem 1rem',
            fontSize: '0.8125rem',
            color: 'var(--color-red)',
            marginBottom: '1.5rem',
          }}
        >
          {state.message}
        </div>
      )}

      {/* ── Result ── */}
      {state.status === 'success' && (() => {
        const { result } = state
        const single = isSingleAggregate(result.rows)
        const singleValue = single ? String(Object.values(result.rows[0]!)[0]) : null

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Question echo */}
            <div>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-ink-3)', marginBottom: '0.375rem' }}>
                Question
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 500, color: 'var(--color-ink)', letterSpacing: '-0.01em' }}>
                {result.question}
              </p>
              {result.label && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', marginTop: '0.25rem' }}>
                  {result.label}
                </p>
              )}
            </div>

            {/* Answer number */}
            {result.rows.length === 0 ? (
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-ink-3)' }}>No results found.</p>
            ) : single ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '3.25rem',
                    fontWeight: 500,
                    letterSpacing: '-0.03em',
                    color: 'var(--color-ink)',
                    lineHeight: 1,
                  }}
                >
                  {singleValue}
                </p>
                {result.trend && (
                  <TrendChip direction={toTrendChipDir(result.trend.direction)} label={result.trend.label} />
                )}
              </div>
            ) : (
              <div>
                <ResultTable rows={result.rows} />
                {result.trend && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <TrendChip direction={toTrendChipDir(result.trend.direction)} label={result.trend.label} />
                  </div>
                )}
              </div>
            )}

            {/* SQL collapsible */}
            <div>
              <button
                onClick={() => setSqlOpen(v => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-ink-2)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginBottom: sqlOpen ? '0.75rem' : 0,
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {sqlOpen ? '▾' : '▸'}
                </span>
                Show SQL
              </button>
              {sqlOpen && (
                <pre
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8125rem',
                    background: 'var(--color-ink)',
                    color: '#F7F4EE',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.65,
                    margin: 0,
                  }}
                >
                  {result.sql}
                </pre>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--color-ink-3)', marginTop: '0.5rem', fontFamily: 'var(--font-mono)' }}>
                Scanned {result.rowCount.toLocaleString()} row{result.rowCount === 1 ? '' : 's'}
              </p>
            </div>

            {/* Pin button */}
            <div>
              {pinned ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-green)', fontWeight: 500 }}>
                  ✓ Pinned to dashboard
                </p>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await pinQueryAction(result.question, result.sql)
                    setPinned(true)
                  }}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-line)',
                    padding: '0.5rem 1rem',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Pin to dashboard
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
