'use client'

import { useState, useTransition } from 'react'
import { generateDraftAction } from '@/app/outreach/actions'

export function GenerateDraftButton({ domain }: { domain: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    setError(null)
    const fd = new FormData()
    fd.set('domain', domain)
    startTransition(async () => {
      const result = await generateDraftAction(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div>
      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}
      <button
        onClick={handleClick}
        disabled={pending}
        className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {pending ? 'Generating draft…' : 'Draft outreach'}
      </button>
    </div>
  )
}
