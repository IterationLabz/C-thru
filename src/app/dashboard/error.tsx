'use client'

import { useEffect } from 'react'
import AppShell from '@/components/AppShell'
import { ErrorBlock } from '@/components/States'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <AppShell>
      <div style={{ marginTop: '3rem' }}>
        <ErrorBlock message="Couldn't load the dashboard. The database may be unreachable." onRetry={reset} />
      </div>
    </AppShell>
  )
}
