import { notFound } from 'next/navigation'
import { getJourney } from '@/lib/journeyEngine'

export const dynamic = 'force-dynamic'

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default async function JourneyPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const decodedId = decodeURIComponent(userId)
  const journey = await getJourney(decodedId)
  if (!journey) notFound()

  const { user, events, identificationAt } = journey

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <a href="/journey" className="hover:text-gray-600">Journey</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700 truncate">{user.email ?? decodedId}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {user.email ?? decodedId}
          </h1>
          <p className="text-sm text-gray-400 font-mono mt-0.5">{decodedId}</p>
          {identificationAt && (
            <p className="text-xs text-gray-400 mt-1">
              Identified at {formatTime(identificationAt)}
            </p>
          )}
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No events found for this user.</p>
        ) : (
          <div className="relative">
            {/* Timeline spine */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

            <ul className="space-y-0">
              {events.map((evt, i) => {
                const isIdentificationSeam =
                  i > 0 &&
                  !events[i - 1]!.postIdentification &&
                  evt.postIdentification

                return (
                  <li key={evt.id}>
                    {/* Identification seam marker */}
                    {isIdentificationSeam && identificationAt && (
                      <div className="relative flex items-center my-3 ml-8">
                        <div className="absolute -left-8 w-8 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-1 ring-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-blue-500 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                          Identified · {formatTime(identificationAt)}
                        </span>
                      </div>
                    )}

                    {/* Event row */}
                    <div className="relative flex items-start gap-4 pl-10 py-2 group">
                      {/* Dot */}
                      <div className="absolute left-3 top-3 w-2 h-2 rounded-full border-2 border-white ring-1 bg-gray-400 ring-gray-300" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className={`text-sm font-mono ${evt.postIdentification ? 'text-gray-800' : 'text-gray-500'}`}>
                            {evt.name}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {formatTime(evt.receivedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                          {evt.anonymousId}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}

              {/* End of timeline: identification seam at the bottom if no post events */}
              {identificationAt && events.every(e => !e.postIdentification) && (
                <li className="relative flex items-center mt-3 ml-8">
                  <div className="absolute -left-8 w-8 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-blue-400 border-2 border-white ring-1 ring-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-blue-500 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
                    Identified · {formatTime(identificationAt)}
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-8">
          {events.length} event{events.length === 1 ? '' : 's'} total
          {events.filter(e => !e.postIdentification).length > 0 && (
            <> · {events.filter(e => !e.postIdentification).length} pre-identification</>
          )}
        </p>
      </div>
    </main>
  )
}
