import { getLlmKeyHint } from '@/lib/llmSettings'
import { AskForm } from './AskForm'

export const dynamic = 'force-dynamic'

export default function AskPage() {
  const hasLlmKey = Boolean(getLlmKeyHint())

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-sm text-gray-400 mb-6">
          <a href="/" className="hover:text-gray-600">Dashboard</a>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Ask</span>
        </nav>

        <div className="flex items-baseline justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Ask a question</h1>
          <a href="/settings" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">Settings →</a>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Ask in plain English — C-thru generates the SQL, shows it to you, then runs it against your data.
          Only <code className="bg-gray-100 px-1 rounded text-xs">SELECT</code> queries against the curated views are allowed.
        </p>

        <AskForm hasLlmKey={hasLlmKey} />
      </div>
    </main>
  )
}
