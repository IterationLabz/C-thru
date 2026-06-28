import { getActiveUsers, getNewSignups, getTopEvents, getLiveCount, getTopCompanies, formatDomain } from '@/lib/dashboardQueries'
import { listPinnedQueries } from '@/lib/pinnedQueries'
import { validateAndRun, QueryResult } from '@/lib/sqlGuard'
import { unpinQueryAction } from '@/app/ask/actions'

export const dynamic = 'force-dynamic'

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

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">C-thru</h1>
          <div className="flex items-center gap-4">
            <a href="/ask" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Ask →</a>
            <a href="/settings" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Settings →</a>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-6 mb-10 lg:grid-cols-4">
          <MetricCard
            label="Active users (7d)"
            value={activeUsers.last7}
            sub={`${activeUsers.last30} last 30 days`}
          />
          <MetricCard
            label="Active users (30d)"
            value={activeUsers.last30}
            sub="identified users with ≥1 event"
          />
          <MetricCard
            label="New signups (7d)"
            value={newSignups.last7}
            sub={`${newSignups.last30} last 30 days`}
          />
          <MetricCard
            label="Live (last 60s)"
            value={liveCount}
            sub="events ingested"
          />
        </div>

        {/* Companies */}
        <section className="mb-10">
          <h2 className="text-base font-semibold text-gray-700 mb-3">Companies</h2>
          {topCompanies.length === 0 ? (
            <p className="text-sm text-gray-400">No company events yet.</p>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Company</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500 hidden sm:table-cell">Domain</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {topCompanies.map((c, i) => (
                    <tr key={c.domain} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-800 font-medium">{formatDomain(c.domain)}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs hidden sm:table-cell">{c.domain}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{c.eventCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Top events */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Top events</h2>
          {topEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No events yet.</p>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Event</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {topEvents.map((e, i) => (
                    <tr key={e.name} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="px-4 py-2 text-gray-800 font-mono">{e.name}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{e.count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pinned questions */}
        {pinnedResults.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-semibold text-gray-700 mb-3">Pinned questions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {pinnedResults.map(({ pq, result, error }) => (
                <div key={pq.id} className="bg-white rounded-lg border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-2 leading-snug">{pq.question}</p>
                  {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                  ) : result && result.rows.length === 1 && Object.keys(result.rows[0]!).length === 1 ? (
                    <p className="text-3xl font-bold text-gray-900 tabular-nums">
                      {String(Object.values(result.rows[0]!)[0])}
                    </p>
                  ) : result ? (
                    <p className="text-sm text-gray-600">{result.rowCount} row{result.rowCount === 1 ? '' : 's'}</p>
                  ) : null}
                  <form action={unpinQueryAction.bind(null, pq.id)} className="mt-3">
                    <button type="submit" className="text-xs text-gray-400 hover:text-red-500 transition-colors">
                      Unpin
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function MetricCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  )
}
