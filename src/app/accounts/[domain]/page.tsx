import { notFound } from 'next/navigation'
import { scoreCompany } from '@/lib/readinessEngine'
import { GenerateDraftButton } from './GenerateDraftButton'

export const dynamic = 'force-dynamic'

function displayName(domain: string): string {
  const stripped = domain.replace(/\.(com|io|co|net|org|ai|app|dev|so|xyz)$/, '')
  return stripped.charAt(0).toUpperCase() + stripped.slice(1)
}

export default async function AccountDetailPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const score = await scoreCompany(domain)
  if (!score) notFound()

  const pct = score.rulesTotal === 0 ? 0 : Math.round((score.rulesMet / score.rulesTotal) * 100)

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <a href="/accounts" className="hover:text-gray-600">Accounts</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">{displayName(domain)}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{displayName(domain)}</h1>
          <p className="text-sm text-gray-400 font-mono mt-1">{domain}</p>
        </div>

        {/* Score summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Readiness score</span>
            <span className="text-2xl font-bold text-gray-900 tabular-nums">
              {score.rulesMet}/{score.rulesTotal}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-800 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">{pct}% of rules met</p>
        </div>

        {/* Per-rule breakdown */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Rule breakdown
          </h2>
          <ul className="space-y-2">
            {score.breakdown.map(r => (
              <li
                key={r.ruleId}
                className="flex items-start justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 text-base leading-none ${r.passed ? 'text-green-500' : 'text-red-400'}`}>
                    {r.passed ? '✓' : '✗'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.value}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Draft outreach CTA */}
        <div className="mt-8 bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Ready to reach out?</h2>
          <p className="text-xs text-gray-400 mb-4">
            C-thru will draft a message grounded in this account&apos;s readiness data.
            You review, edit, and send — never automatic.
          </p>
          <GenerateDraftButton domain={domain} />
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Scores computed live from your data.{' '}
          <a href="/settings" className="underline hover:text-gray-600">Edit rules →</a>
        </p>
      </div>
    </main>
  )
}
