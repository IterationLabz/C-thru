'use client'

import { useState, useTransition } from 'react'
import type { AskResult } from '@/lib/ask'
import type { Trend } from '@/lib/trendComputer'
import { pinQueryAction } from './actions'

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: AskResult }
  | { status: 'error'; message: string }

function isSingleAggregate(rows: Record<string, unknown>[]): boolean {
  return rows.length === 1 && Object.keys(rows[0]!).length === 1
}

function TrendBadge({ trend }: { trend: Trend }) {
  const colors: Record<string, string> = {
    up:   'bg-green-50 text-green-700 border-green-200',
    down: 'bg-red-50 text-red-700 border-red-200',
    flat: 'bg-gray-50 text-gray-600 border-gray-200',
    new:  'bg-blue-50 text-blue-700 border-blue-200',
  }
  return (
    <span className={`inline-block text-xs px-2 py-1 rounded border ${colors[trend.direction] ?? colors.flat}`}>
      {trend.label}
    </span>
  )
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const cols = Object.keys(rows[0]!)
  return (
    <div className="overflow-x-auto rounded border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {cols.map(c => (
              <th key={c} className="text-left px-4 py-2 font-medium text-gray-500">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
              {cols.map(c => (
                <td key={c} className="px-4 py-2 text-gray-800 font-mono text-xs">
                  {row[c] == null ? <span className="text-gray-400">null</span> : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AskForm({ hasLlmKey }: { hasLlmKey: boolean }) {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<State>({ status: 'idle' })
  const [isPending, startTransition] = useTransition()
  const [pinned, setPinned] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return

    setState({ status: 'loading' })
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
      <form onSubmit={handleSubmit} className="mb-8">
        <textarea
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="How many signups last 7 days? Which companies are most active?"
          rows={3}
          disabled={loading || !hasLlmKey}
          className="w-full border border-gray-300 rounded px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400 mb-3"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !question.trim() || !hasLlmKey}
            className="bg-gray-900 text-white text-sm px-5 py-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {loading ? 'Asking…' : 'Ask'}
          </button>
          {!hasLlmKey && (
            <p className="text-sm text-amber-700">
              No LLM key configured.{' '}
              <a href="/settings" className="underline hover:text-amber-900">Add one in Settings →</a>
            </p>
          )}
        </div>
      </form>

      {state.status === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-3 text-sm text-red-700 mb-6">
          {state.message}
        </div>
      )}

      {state.status === 'success' && (() => {
        const { result } = state
        const single = isSingleAggregate(result.rows)
        const singleValue = single ? String(Object.values(result.rows[0]!)[0]) : null

        return (
          <div className="space-y-6">
            {/* Answer */}
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Answer</h2>
              {result.rows.length === 0 ? (
                <p className="text-sm text-gray-500">No results.</p>
              ) : single ? (
                <div>
                  <p className="text-4xl font-bold text-gray-900 tabular-nums">{singleValue}</p>
                  {result.trend && (
                    <div className="mt-2">
                      <TrendBadge trend={result.trend} />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <ResultTable rows={result.rows} />
                  {result.trend && (
                    <div className="mt-2">
                      <TrendBadge trend={result.trend} />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* SQL */}
            <section>
              <details className="group">
                <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wide cursor-pointer select-none hover:text-gray-600 transition-colors">
                  SQL <span className="text-gray-300 group-open:hidden">▸</span>
                  <span className="text-gray-300 hidden group-open:inline">▾</span>
                </summary>
                <pre className="mt-2 bg-gray-900 text-gray-100 text-xs rounded p-4 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {result.sql}
                </pre>
              </details>
              <p className="text-xs text-gray-400 mt-1">
                {result.rowCount.toLocaleString()} row{result.rowCount === 1 ? '' : 's'} returned
              </p>
            </section>

            {/* Pin */}
            <section>
              {pinned ? (
                <p className="text-sm text-green-700">Pinned to dashboard.</p>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await pinQueryAction(result.question, result.sql)
                    setPinned(true)
                  }}
                  className="text-sm border border-gray-300 rounded px-4 py-2 hover:bg-gray-50 transition-colors text-gray-700"
                >
                  Pin to Dashboard
                </button>
              )}
            </section>
          </div>
        )
      })()}
    </div>
  )
}
