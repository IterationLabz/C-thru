'use client'

import { useState } from 'react'

// Template disclosure clause (D-37, v1).
// When this text changes, CURRENT_CLAUSE_VERSION in consentGate.ts must increment.
const CLAUSE_TEXT = `This website uses session recording to improve the product experience. Sessions are recorded only after your user account is identified. Input values (including passwords and payment fields) are masked by default. Recordings are retained for [N] days and are accessible only to the product owner. You may contact us to request deletion of your recording.`

interface ReplayEnableFormProps {
  enableAction: (formData: FormData) => Promise<{ error?: string }>
  clauseVersion: number
  retentionDays: number
}

export function ReplayEnableForm({ enableAction, clauseVersion, retentionDays }: ReplayEnableFormProps) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clause = CLAUSE_TEXT.replace('[N]', String(retentionDays))

  async function handleSubmit(formData: FormData) {
    formData.set('acknowledged', acknowledged ? 'true' : 'false')
    const result = await enableAction(formData)
    if (result.error) setError(result.error)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Disclosure clause (v{clauseVersion})
        </p>
        <blockquote className="text-sm text-gray-600 bg-gray-50 border-l-4 border-gray-300 pl-4 py-2 italic rounded-r">
          {clause}
        </blockquote>
        <p className="text-xs text-gray-400">
          Copy this language into your privacy policy before enabling. The retention window above reflects your current setting.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={e => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-400"
          />
          <span className="text-sm text-gray-700">
            I have disclosed or will disclose session recording in my privacy policy before enabling.
            I understand this is acknowledged with a timestamp (clause v{clauseVersion}).
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!acknowledged}
          className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Enable Session Replay
        </button>
      </form>
    </div>
  )
}
