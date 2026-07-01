import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function JourneyLoading() {
  return (
    <AppShell maxWidth="56rem">
      <div style={{ marginBottom: '2.25rem' }}>
        <SkeletonLine width="8rem" height="2.5rem" style={{ marginBottom: '0.25rem' }} />
        <SkeletonLine width="18rem" height="1rem" />
      </div>

      <SkeletonCard style={{ height: '400px' }} />
    </AppShell>
  )
}
