import { listFunnels, evaluateFunnel, type FunnelStepResult } from '@/lib/funnelEngine'
import { saveFunnelAction, deleteFunnelAction } from './actions'

export const dynamic = 'force-dynamic'

function FunnelBar({ steps }: { steps: FunnelStepResult[] }) {
  const max = steps[0]?.count ?? 1
  return (
    <div className="space-y-2 mt-3">
      {steps.map((step, i) => {
        const pct = max === 0 ? 0 : Math.round((step.count / max) * 100)
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-gray-600">{step.eventName}</span>
              <span className="text-xs text-gray-400 tabular-nums">
                {step.count.toLocaleString()}
                {i > 0 && step.dropoffPct > 0 && (
                  <span className="ml-1 text-red-400">−{step.dropoffPct}%</span>
                )}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gray-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function FunnelsPage() {
  const saved = await listFunnels()

  const funnelResults = await Promise.all(
    saved.map(async f => {
      try {
        const result = await evaluateFunnel({ steps: f.steps, mode: f.mode, windowDays: f.windowDays })
        return { funnel: f, result, error: null }
      } catch (e) {
        return { funnel: f, result: null, error: e instanceof Error ? e.message : 'Error' }
      }
    })
  )

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Funnels</span>
        </nav>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Funnels</h1>
        </div>

        {/* Saved funnels */}
        {funnelResults.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center mb-8">
            <p className="text-gray-500 text-sm">No funnels saved yet.</p>
            <p className="text-gray-400 text-xs mt-1">Create one below to see how users move through your product.</p>
          </div>
        ) : (
          <div className="grid gap-4 mb-8">
            {funnelResults.map(({ funnel, result, error }) => (
              <div key={funnel.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900">{funnel.name}</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {funnel.mode} mode · {funnel.windowDays}d window · {funnel.steps.length} steps
                    </p>
                  </div>
                  <form action={deleteFunnelAction}>
                    <input type="hidden" name="id" value={funnel.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Delete
                    </button>
                  </form>
                </div>
                {error ? (
                  <p className="text-sm text-red-600 mt-3">{error}</p>
                ) : result ? (
                  <FunnelBar steps={result.steps} />
                ) : null}
              </div>
            ))}
          </div>
        )}

        {/* Create funnel form */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">New funnel</h2>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <CreateFunnelForm />
          </div>
        </section>
      </div>
    </main>
  )
}

function CreateFunnelForm() {
  return (
    <form action={saveFunnelAction} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1">Funnel name</label>
        <input
          name="name"
          required
          placeholder="e.g. Onboarding flow"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Mode</label>
          <select name="mode" className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="user">User</option>
            <option value="company">Company</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Window (days)</label>
          <input
            name="window_days"
            type="number"
            min="1"
            defaultValue="30"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Steps (one event name per line, min 2)
        </label>
        <textarea
          name="steps_raw"
          rows={4}
          placeholder={'signup\nactivate\npayment_intent'}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
        <p className="text-xs text-gray-400 mt-1">
          Enter event names exactly as they appear in your data.
        </p>
      </div>

      <button
        type="submit"
        className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
      >
        Save funnel
      </button>
    </form>
  )
}

