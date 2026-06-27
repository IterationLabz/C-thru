import { listKeyEvents } from '@/lib/keyEvents'
import { addKeyEventAction, deleteKeyEventAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const keyEvents = await listKeyEvents()

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Settings</span>
        </nav>

        <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>

        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-1">Key events</h2>
          <p className="text-sm text-gray-400 mb-4">
            Mark events that signal meaningful product milestones — e.g. <code className="bg-gray-100 px-1 rounded">payment_succeeded</code>.
          </p>

          {/* Add form */}
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

          {/* List */}
          {keyEvents.length === 0 ? (
            <p className="text-sm text-gray-400">No key events defined yet.</p>
          ) : (
            <ul className="space-y-1">
              {keyEvents.map(e => (
                <li key={e.name} className="flex items-center justify-between bg-white border border-gray-200 rounded px-4 py-2">
                  <span className="font-mono text-sm text-gray-800">{e.name}</span>
                  <form action={deleteKeyEventAction}>
                    <input type="hidden" name="name" value={e.name} />
                    <button
                      type="submit"
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
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
