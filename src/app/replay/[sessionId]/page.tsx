import { notFound } from 'next/navigation'
import { getSessionForPlayer } from '@/lib/replay/playerLoader'
import { ReplayPlayer } from './ReplayPlayer'

export const dynamic = 'force-dynamic'

export default async function ReplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { sessionId } = await params
  const { from } = await searchParams
  const result = await getSessionForPlayer(sessionId)

  // Failure state 3: deleted per retention policy (D-36)
  if (result.status === 'expired') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          {from && (
            <a href={from} className="text-sm text-gray-400 hover:text-gray-600 block mb-6">
              ← Back
            </a>
          )}
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Recording unavailable</h1>
          <p className="text-sm text-gray-500">
            This recording has been deleted per the retention policy.
          </p>
        </div>
      </main>
    )
  }

  if (result.status === 'not_found') {
    notFound()
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {from && (
          <a href={from} className="text-sm text-gray-400 hover:text-gray-600 block mb-4">
            ← Back to journey
          </a>
        )}

        {/* Failure state 1: incomplete recording banner (D-36) */}
        {!result.complete && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            This recording is incomplete — some events may be missing. Playback shows what was captured.
          </div>
        )}

        <div className="flex gap-6">
          {/* Player (failure state 2: large session → progressive playback handled by rrweb-player) */}
          <div className="flex-1">
            <ReplayPlayer stream={Array.from(result.stream)} />
          </div>

          {/* Metadata panel (D-36) */}
          <aside className="w-64 shrink-0 space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Session</h2>

              {result.metadata.userEmail && (
                <div>
                  <p className="text-xs text-gray-400">User</p>
                  <p className="text-sm text-gray-900 font-mono truncate">{result.metadata.userEmail}</p>
                </div>
              )}

              {result.metadata.companyDomain && (
                <div>
                  <p className="text-xs text-gray-400">Company</p>
                  <p className="text-sm text-gray-900 font-mono">{result.metadata.companyDomain}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400">Started</p>
                <p className="text-sm text-gray-900">
                  {result.metadata.startedAt.toLocaleString()}
                </p>
              </div>

              {result.metadata.durationMs !== null && (
                <div>
                  <p className="text-xs text-gray-400">Duration</p>
                  <p className="text-sm text-gray-900">
                    {Math.round(result.metadata.durationMs / 1000)}s
                  </p>
                </div>
              )}
            </div>

            {/* Masking notice — always-true policy statement (D-36) */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                C-thru masks input values by default. Sensitive fields (passwords, payment
                info) are never captured.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}
