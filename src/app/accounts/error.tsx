'use client'

import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { ErrorBlock } from '@/components/States'

export default function AccountsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <AppShell maxWidth="60rem">
      <div style={{ marginTop: '3rem' }}>
        <ErrorBlock message="Couldn't load accounts. The database may be unreachable." onRetry={reset} />
      </div>
    </AppShell>
  )
}
