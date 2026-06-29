import { listKeyEvents } from '@/lib/keyEvents'
import { listBlockedDomains } from '@/lib/blockedDomains'
import { getLlmKeyHint, getLlmProviderConfig } from '@/lib/llmSettings'
import { listRules } from '@/lib/readinessEngine'
import { getOutreachSettings } from '@/lib/outreachDraft'
import { listTriggerRules } from '@/lib/triggerEngine'
import { listSuppressions } from '@/lib/suppressionList'
import {
  addKeyEventAction, deleteKeyEventAction,
  addBlockedDomainAction, removeBlockedDomainAction,
  saveLlmConfigAction, addRuleAction, deleteRuleAction,
  saveOutreachSettingsAction, saveVoiceSampleAction, deleteVoiceSampleAction,
  addTriggerRuleAction, deleteTriggerRuleAction,
  addSuppressionAction, removeSuppressionAction,
} from './actions'
import { VerifyKeyButton } from './VerifyKeyButton'

export const dynamic = 'force-dynamic'

const PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic',  models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'] },
  { value: 'openai',    label: 'OpenAI',      models: ['gpt-4o-mini', 'gpt-4o'] },
  { value: 'groq',      label: 'Groq',        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
]

export default async function SettingsPage() {
  const [keyEvents, blockedDomains, rules, outreachSettings, triggerRules, suppressions] = await Promise.all([
    listKeyEvents(),
    listBlockedDomains(),
    listRules(),
    getOutreachSettings(),
    listTriggerRules(),
    listSuppressions(),
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

        {/* Readiness Rules */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Readiness Rules</h2>
          <p className="text-sm text-gray-400 mb-4">
            Define what &quot;ready to pay&quot; means. Each rule is one typed condition on one signal.{' '}
            <a href="/accounts" className="text-gray-600 hover:text-gray-900 underline">View accounts →</a>
          </p>

          {rules.length === 0 ? (
            <p className="text-sm text-gray-400 mb-6">No rules defined yet.</p>
          ) : (
            <ul className="space-y-1 mb-6">
              {rules.map(r => (
                <li key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2">
                  <div>
                    <span className="text-sm text-gray-800 font-medium">{r.label}</span>
                    <span className="ml-3 text-xs text-gray-400 font-mono">
                      {r.signal} {r.operator} {r.threshold}
                      {r.window_days ? ` (${r.window_days}d)` : ''}
                      {r.event_name ? ` — ${r.event_name}` : ''}
                    </span>
                  </div>
                  <form action={deleteRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={addRuleAction} className="grid grid-cols-2 gap-3 bg-white border border-gray-200 rounded p-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input name="label" required placeholder="Active users ≥ 3 (last 30d)"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Signal</label>
              <select name="signal" className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value="active_users">Active users</option>
                <option value="total_events">Total events</option>
                <option value="days_since_active">Days since active</option>
                <option value="key_event_fired">Key event fired</option>
                <option value="days_in_product">Days in product</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Operator</label>
              <select name="operator" className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                <option value=">=">≥ (at least)</option>
                <option value="<=">≤ (at most)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Threshold</label>
              <input name="threshold" type="number" required min="0" defaultValue="3"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Window (days, optional)</label>
              <input name="window_days" type="number" min="1" placeholder="30"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Event name (for key_event_fired only)</label>
              <input name="event_name" placeholder="payment_intent"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
            </div>
            <div className="col-span-2">
              <button type="submit"
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors">
                Add rule
              </button>
            </div>
          </form>
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

        {/* Outreach — Slack webhook + cooldown */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Outreach</h2>
          <p className="text-sm text-gray-400 mb-4">
            Configure your Slack webhook and per-domain send cooldown.{' '}
            <a href="/outreach" className="text-gray-600 hover:text-gray-900 underline">View outreach queue →</a>
          </p>
          <form action={saveOutreachSettingsAction} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slack incoming webhook URL</label>
              <input
                type="url"
                name="slack_webhook_url"
                defaultValue={outreachSettings.slack_webhook_url ?? ''}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">Stored server-side — never exposed in the browser.</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Send cooldown (days)</label>
              <input
                type="number"
                name="cooldown_days"
                defaultValue={outreachSettings.cooldown_days}
                min="1"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Triggered drafts are suppressed if this domain was contacted within the window. Manual drafts show a warning but are not blocked.
              </p>
            </div>
            <button
              type="submit"
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Save outreach settings
            </button>
          </form>
        </section>

        {/* Founder voice sample */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Founder voice</h2>
          <p className="text-sm text-gray-400 mb-4">
            Paste 2–5 sentences of your own writing (an email, a Slack message). C-thru will match the tone.
            Optional — without a sample, drafts use generic professional tone.
          </p>
          {outreachSettings.voice_sample ? (
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-1">Current sample:</p>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white border border-gray-200 rounded px-4 py-3 font-sans">
                {outreachSettings.voice_sample}
              </pre>
              <form action={deleteVoiceSampleAction} className="mt-2">
                <button
                  type="submit"
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Delete voice sample (hard-deleted, no archive)
                </button>
              </form>
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-4">No voice sample saved.</p>
          )}
          <form action={saveVoiceSampleAction} className="space-y-3">
            <textarea
              name="voice_sample"
              rows={4}
              placeholder="Hey, I noticed your team has been using the product a lot lately — wanted to reach out and see if there's anything I can do to help you get more out of it."
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
            />
            <button
              type="submit"
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Save voice sample
            </button>
          </form>
        </section>

        {/* Trigger rules */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Trigger rules</h2>
          <p className="text-sm text-gray-400 mb-4">
            When an account crosses a threshold, C-thru creates a draft automatically — it never sends.
          </p>
          {triggerRules.length === 0 ? (
            <p className="text-sm text-gray-400 mb-6">No trigger rules defined.</p>
          ) : (
            <ul className="space-y-1 mb-6">
              {triggerRules.map(r => (
                <li key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2">
                  <div>
                    <span className="text-sm text-gray-800 font-medium">{r.label}</span>
                    <span className="ml-3 text-xs text-gray-400 font-mono">
                      when {r.rules_met_min}/{r.rules_total} rules met
                    </span>
                  </div>
                  <form action={deleteTriggerRuleAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addTriggerRuleAction} className="grid grid-cols-2 gap-3 bg-white border border-gray-200 rounded p-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input name="label" required placeholder="Ready to close — 4/5 rules met"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Minimum rules met</label>
              <input name="rules_met_min" type="number" required min="1" defaultValue="4"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Out of (total rules)</label>
              <input name="rules_total" type="number" required min="1" defaultValue="5"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <button type="submit"
                className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors">
                Add trigger rule
              </button>
            </div>
          </form>
        </section>

        {/* Suppression list */}
        <section className="mb-12">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Suppression list</h2>
          <p className="text-sm text-gray-400 mb-4">
            Hard blocks — no draft or send action will proceed if the domain or email matches. Cannot be overridden.
          </p>
          {suppressions.filter(s => !s.removed_at).length === 0 ? (
            <p className="text-sm text-gray-400 mb-6">No suppressed domains or emails.</p>
          ) : (
            <ul className="space-y-1 mb-6">
              {suppressions.filter(s => !s.removed_at).map(s => (
                <li key={s.id} className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2">
                  <div>
                    <span className="text-xs text-gray-400 font-mono uppercase mr-2">{s.entry_type}</span>
                    <span className="text-sm text-gray-800 font-mono">{s.value}</span>
                  </div>
                  <form action={removeSuppressionAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      onClick={e => {
                        if (!confirm('This person asked not to be contacted. Removing them allows C-thru to draft outreach to them again. Are you sure?')) {
                          e.preventDefault()
                        }
                      }}
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addSuppressionAction} className="flex gap-3 bg-white border border-gray-200 rounded p-4">
            <select name="entry_type"
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="email">Email</option>
              <option value="domain">Domain</option>
            </select>
            <input name="value" required placeholder="person@company.com or company.com"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-400" />
            <button type="submit"
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors">
              Add
            </button>
          </form>
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
