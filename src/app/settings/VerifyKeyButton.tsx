'use client'

import { useState, useTransition } from 'react'
import { verifyLlmKeyAction } from './actions'

export function VerifyKeyButton() {
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const res = await verifyLlmKeyAction()
      setResult(res)
    })
  }

  return (
    <div className="flex items-center gap-3 mt-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-sm border border-gray-300 rounded px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Verifying…' : 'Verify key'}
      </button>
      {result && (
        result.ok
          ? <span className="text-sm text-green-700">✓ Key is valid</span>
          : <span className="text-sm text-red-600">✗ {result.error}</span>
      )}
    </div>
  )
}
