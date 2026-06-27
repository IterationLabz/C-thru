import { getActiveUsers, getNewSignups, getTopEvents, getLiveCount } from '@/lib/dashboardQueries'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [activeUsers, newSignups, topEvents, liveCount] = await Promise.all([
    getActiveUsers(),
    getNewSignups(),
    getTopEvents(),
    getLiveCount(),
  ])

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">C-thru</h1>

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
