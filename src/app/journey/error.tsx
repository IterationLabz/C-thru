'use client'

import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { ErrorBlock } from '@/components/States'

export default function JourneyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <AppShell maxWidth="56rem">
      <div style={{ marginTop: '3rem' }}>
        <ErrorBlock message="Couldn't load journey data. The database may be unreachable." onRetry={reset} />
      </div>
    </AppShell>
  )
}
