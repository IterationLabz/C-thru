import { listUsersForJourney } from '@/lib/journeyEngine'

export const dynamic = 'force-dynamic'

export default async function JourneyIndexPage() {
  const users = await listUsersForJourney(50)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Journey</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">User Journeys</h1>

        {users.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-sm">No identified users yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">User</th>
                  <th className="text-right px-4 py-3">Events</th>
                  <th className="text-right px-4 py-3">Last active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.userId} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === users.length - 1 ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3 text-gray-800">
                      {u.email ?? <span className="font-mono text-gray-400 text-xs">{u.userId}</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{u.eventCount}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(u.lastEventAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/journey/${encodeURIComponent(u.userId)}`}
                        className="text-xs text-gray-400 hover:text-gray-700 underline"
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
