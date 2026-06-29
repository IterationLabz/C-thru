import { scoreAllCompanies } from '@/lib/readinessEngine'
import { evaluateTriggers } from '@/lib/triggerEngine'
import { listDrafts } from '@/lib/outreachDraft'
import { dismissDraftAction } from './actions'

export const dynamic = 'force-dynamic'

function displayName(domain: string): string {
  const stripped = domain.replace(/\.(com|io|co|net|org|ai|app|dev|so|xyz)$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export default async function OutreachPage() {
  // evaluateTriggers runs synchronously on page load — no background job (D-27).
  const scores = await scoreAllCompanies()
  await evaluateTriggers(scores)

  const scoreMap = new Map(scores.map(s => [s.domain, s]))
  const [pending, history] = await Promise.all([
    listDrafts('pending'),
    (async () => {
      const sent = await listDrafts('sent')
      const dismissed = await listDrafts('dismissed')
      return [...sent, ...dismissed].sort(
        (a, b) => (b.created_at as unknown as number) - (a.created_at as unknown as number)
      )
    })(),
  ])

  // Sort pending by readiness score descending.
  const pendingSorted = [...pending].sort((a, b) => {
    const sa = scoreMap.get(a.domain)
    const sb = scoreMap.get(b.domain)
    const ra = sa ? sa.rulesMet / sa.rulesTotal : 0
    const rb = sb ? sb.rulesMet / sb.rulesTotal : 0
    return rb - ra
  })

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Outreach</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Outreach queue</h1>
        <p className="text-sm text-gray-400 mb-8">
          Drafts ready for your review. C-thru never sends automatically.
        </p>

        {/* Pending drafts */}
        {pendingSorted.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center mb-8">
            <p className="text-sm text-gray-400">No pending drafts.</p>
            <p className="text-xs text-gray-400 mt-1">
              Go to an account and click <strong>Draft outreach</strong>, or add trigger rules in{' '}
              <a href="/settings" className="underline hover:text-gray-600">Settings</a>.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 mb-10">
            {pendingSorted.map(draft => {
              const score = scoreMap.get(draft.domain)
              return (
                <li key={draft.id} className="bg-white border border-gray-200 rounded-lg px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <a
                          href={`/outreach/${draft.id}`}
                          className="text-sm font-semibold text-gray-900 hover:underline"
                        >
                          {displayName(draft.domain)}
                        </a>
                        <span className="font-mono text-xs text-gray-400">{draft.domain}</span>
                        {draft.created_by === 'trigger' && (
                          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">
                            auto-triggered
                          </span>
                        )}
                      </div>
                      {score && (
                        <p className="text-xs text-gray-500">
                          Readiness: {score.rulesMet}/{score.rulesTotal} rules met
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <a
                        href={`/outreach/${draft.id}`}
                        className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700 transition-colors"
                      >
                        Review & send
                      </a>
                      <form action={dismissDraftAction}>
                        <input type="hidden" name="draft_id" value={draft.id} />
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          Dismiss
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* History */}
        {history.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              History
            </h2>
            <ul className="space-y-2">
              {history.map(draft => (
                <li
                  key={draft.id}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-4 py-3"
                >
                  <div>
                    <span className="text-sm text-gray-700 font-medium">
                      {displayName(draft.domain)}
                    </span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{draft.domain}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium ${
                        draft.status === 'sent' ? 'text-green-600' : 'text-gray-400'
                      }`}
                    >
                      {draft.status === 'sent' ? 'Sent / copied' : 'Dismissed'}
                    </span>
                    <a
                      href={`/outreach/${draft.id}`}
                      className="text-xs text-gray-400 hover:text-gray-600 underline"
                    >
                      View
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}
