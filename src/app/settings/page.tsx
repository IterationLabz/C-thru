import { listKeyEvents } from '@/lib/keyEvents'
import { listBlockedDomains } from '@/lib/blockedDomains'
import { getLlmKeyHint, getLlmProviderConfig } from '@/lib/llmSettings'
import { addKeyEventAction, deleteKeyEventAction, addBlockedDomainAction, removeBlockedDomainAction, saveLlmConfigAction } from './actions'
import { VerifyKeyButton } from './VerifyKeyButton'

export const dynamic = 'force-dynamic'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic',  models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] },
  { value: 'openai',    label: 'OpenAI',      models: ['gpt-4o-mini', 'gpt-4o'] },
  { value: 'groq',      label: 'Groq',        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
]

export default async function SettingsPage() {
  const [keyEvents, blockedDomains] = await Promise.all([
    listKeyEvents(),
    listBlockedDomains(),
  ])
  const llmKeyHint = getLlmKeyHint()
  const { provider: currentProvider, model: currentModel } = getLlmProviderConfig()

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Settings</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

        {/* Vibe Analytics — LLM key */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Vibe Analytics</h2>
          <p className="text-sm text-gray-400 mb-4">
            Ask questions about your data in plain English. Requires your own LLM API key — it stays on your server.{' '}
            {llmKeyHint && (
              <a href="/ask" className="text-gray-600 hover:text-gray-900 underline">Open /ask →</a>
            )}
          </p>

          {/* Key status */}
          <div className="mb-4">
            {llmKeyHint ? (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                LLM key configured: <code className="font-mono">{llmKeyHint}</code>
              </p>
            ) : (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                No LLM key set — <code className="font-mono">/ask</code> is unavailable. Add{' '}
                <code className="font-mono">CTHRU_LLM_KEY</code> to{' '}
                <code className="font-mono">.env.local</code> or paste below.
              </p>
            )}
          </div>

          {/* Paste-in form */}
          <form action={saveLlmConfigAction} className="space-y-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">API key</label>
              <input
                type="password"
                name="llm_key"
                placeholder="sk-ant-... or sk-..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Provider</label>
                <select
                  name="llm_provider"
                  defaultValue={currentProvider}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {PROVIDERS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select
                  name="llm_model"
                  defaultValue={currentModel}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  {PROVIDERS.flatMap(p => p.models).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
              >
                Save to .env.local
              </button>
              <p className="text-xs text-gray-400">Restart the server after saving.</p>
            </div>
          </form>

          {/* Verify key */}
          {llmKeyHint && <VerifyKeyButton />}

          {/* Cost summary placeholder — populated once /api/ask records usage */}
          <p className="text-xs text-gray-400 mt-4">
            Cost summary — approximate, check your provider&apos;s current pricing. No query history yet.
          </p>
        </section>

        {/* Key events */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Key events</h2>
          <p className="text-sm text-gray-400 mb-4">
            Mark events that signal meaningful product milestones — e.g.{' '}
            <code className="bg-gray-100 px-1 rounded">payment_succeeded</code>.
          </p>

          <form action={addKeyEventAction} className="flex gap-2 mb-6">
            <input
              type="text"
              name="name"
              required
              placeholder="event_name"
              maxLength={200}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Add
            </button>
          </form>

          {keyEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No key events defined yet.</p>
          ) : (
            <ul className="space-y-1">
              {keyEvents.map(e => (
                <li key={e.name} className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2">
                  <span className="font-mono text-sm text-gray-800">{e.name}</span>
                  <form action={deleteKeyEventAction}>
                    <input type="hidden" name="name" value={e.name} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Blocked domains */}
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-1">Blocked domains</h2>
          <p className="text-sm text-gray-400 mb-4">
            Emails from these domains are treated as personal and excluded from company grouping.
          </p>

          <form action={addBlockedDomainAction} className="flex gap-2 mb-6">
            <input
              type="text"
              name="domain"
              required
              placeholder="gmail.com"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Add
            </button>
          </form>

          {blockedDomains.length === 0 ? (
            <p className="text-sm text-gray-400">No blocked domains.</p>
          ) : (
            <ul className="space-y-1">
              {blockedDomains.map(domain => (
                <li key={domain} className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2">
                  <span className="font-mono text-sm text-gray-800">{domain}</span>
                  <form action={removeBlockedDomainAction}>
                    <input type="hidden" name="domain" value={domain} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}
