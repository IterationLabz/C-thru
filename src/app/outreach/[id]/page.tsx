import { notFound } from 'next/navigation'
import { getDraft, getOutreachSettings, getTopUsers, scanUngroundedClaims } from '@/lib/outreachDraft'
import { scoreCompany } from '@/lib/readinessEngine'
import { DraftActions } from './DraftActions'

export const dynamic = 'force-dynamic'

function displayName(domain: string): string {
  const stripped = domain.replace(/\.(com|io|co|net|org|ai|app|dev|so|xyz)$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export default async function DraftReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ warning?: string }>
}) {
  const { id } = await params
  const { warning } = await searchParams
  const draftId = Number(id)

  const [draft, settings] = await Promise.all([getDraft(draftId), getOutreachSettings()])
  if (!draft) notFound()

  const [score, topUsers] = await Promise.all([
    scoreCompany(draft.domain),
    getTopUsers(draft.domain),
  ])

  const warnings = scanUngroundedClaims(draft.draft_text)
  const defaultRecipient = topUsers[0]?.email ?? ''
  const voiceMode = settings.voice_sample
    ? 'Drafted in your voice'
    : 'Generic tone — add a voice sample in Settings to personalise'
  const isDone = draft.status !== 'pending'

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <a href="/outreach" className="hover:text-gray-600">Outreach</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{displayName(draft.domain)}</span>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{displayName(draft.domain)}</h1>
            {draft.created_by === 'trigger' && (
              <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded px-2 py-0.5">
                auto-triggered
              </span>
            )}
            {isDone && (
              <span className="text-xs bg-gray-100 text-gray-500 border border-gray-200 rounded px-2 py-0.5">
                {draft.status}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 font-mono">{draft.domain}</p>
        </div>

        {/* Cooldown warning passed via redirect */}
        {warning && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded px-4 py-3">
            <p className="text-sm text-amber-700">⚠ {decodeURIComponent(warning)}</p>
          </div>
        )}

        {/* Readiness summary */}
        {score && (
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Readiness</p>
            <p className="text-sm text-gray-800 font-medium mb-2">
              {score.rulesMet}/{score.rulesTotal} rules met
            </p>
            <ul className="space-y-1">
              {score.breakdown.map(r => (
                <li key={r.ruleId} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className={r.passed ? 'text-green-500' : 'text-red-400'}>{r.passed ? '✓' : '✗'}</span>
                  <span>{r.label}</span>
                  <span className="text-gray-400">— {r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ungrounded claims warnings (D-25) */}
        {warnings.length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded px-4 py-3 space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-red-700">{w}</p>
            ))}
          </div>
        )}

        {/* Voice mode indicator (D-30) */}
        <p className="text-xs text-gray-400 mb-4 italic">{voiceMode}</p>

        {isDone ? (
          // Read-only view for sent/dismissed drafts.
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide font-semibold">Draft</p>
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">{draft.draft_text}</pre>
          </div>
        ) : (
          <DraftActions
            draftId={draft.id}
            initialText={draft.draft_text}
            defaultRecipient={defaultRecipient}
            hasSlack={!!settings.slack_webhook_url}
          />
        )}
      </div>
    </main>
  )
}
