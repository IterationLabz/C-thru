'use client'

import { useState, useTransition } from 'react'
import { sendSlackAction, recordCopyAction, dismissDraftAction } from '../actions'

interface Props {
  draftId: number
  initialText: string
  defaultRecipient: string
  hasSlack: boolean
}

export function DraftActions({ draftId, initialText, defaultRecipient, hasSlack }: Props) {
  const [text, setText] = useState(initialText)
  const [recipient, setRecipient] = useState(defaultRecipient)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSlack() {
    setError(null)
    const fd = new FormData()
    fd.set('draft_id', String(draftId))
    fd.set('recipient', recipient)
    fd.set('draft_text', text)
    startTransition(async () => {
      const result = await sendSlackAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  function handleCopy() {
    setError(null)
    try { navigator.clipboard.writeText(text) } catch (_) {}
    const fd = new FormData()
    fd.set('draft_id', String(draftId))
    fd.set('recipient', recipient)
    fd.set('draft_text', text)
    startTransition(async () => {
      const result = await recordCopyAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  function handleDismiss() {
    setError(null)
    const fd = new FormData()
    fd.set('draft_id', String(draftId))
    startTransition(async () => {
      await dismissDraftAction(fd)
    })
  }

  return (
    <div>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Recipient field */}
      <div className="mb-4">
        <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">
          Recipient
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Pre-filled from the most active user. Edit or clear before sending.
        </p>
        <input
          type="email"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          placeholder="email@company.com"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      </div>

      {/* Editable draft */}
      <div className="mb-6">
        <label className="block text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">
          Draft
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Edit freely. What you send here is what goes out — not the original generated text.
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={8}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
        />
      </div>

      {/* Send actions — always deliberate, never automatic (D-26) */}
      <div className="flex flex-col gap-3">
        {hasSlack && (
          <button
            onClick={handleSlack}
            disabled={pending}
            className="w-full bg-gray-900 text-white text-sm px-4 py-2.5 rounded hover:bg-gray-700 transition-colors text-left disabled:opacity-50"
          >
            Send to Slack
          </button>
        )}

        <button
          onClick={handleCopy}
          disabled={pending}
          className="w-full bg-white border border-gray-300 text-gray-700 text-sm px-4 py-2.5 rounded hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
        >
          Copy to clipboard — paste into your own email client
        </button>

        <button
          onClick={handleDismiss}
          disabled={pending}
          className="w-full text-gray-400 text-sm px-4 py-2 rounded hover:text-gray-600 transition-colors text-left disabled:opacity-50"
        >
          Dismiss — not acting on this account right now
        </button>
      </div>

      {/* Compliance reminder (D-29) */}
      <p className="text-xs text-gray-400 mt-6 border-t border-gray-100 pt-4">
        Personal 1:1 outreach only. C-thru logs what you copy or send to Slack — not what happens in your inbox.
      </p>
    </div>
  )
}
