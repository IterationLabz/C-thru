import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function DraftDetailLoading() {
  return (
    <AppShell maxWidth="52rem">
      <div style={{ marginBottom: '1.75rem' }}>
        <SkeletonLine width="10rem" height="1rem" />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
          <SkeletonLine width="16rem" height="2.25rem" />
          <SkeletonCard style={{ width: '60px', height: '24px', padding: 0 }} />
        </div>
        <SkeletonLine width="8rem" height="1rem" />
      </div>

      <SkeletonCard style={{ height: '140px', marginBottom: '1.25rem' }} />

      <SkeletonLine width="10rem" height="1rem" style={{ marginBottom: '1.25rem' }} />

      <SkeletonCard style={{ height: '240px' }} />
    </AppShell>
  )
}
