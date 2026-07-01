import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function AccountDetailLoading() {
  return (
    <AppShell maxWidth="52rem">
      <div style={{ marginBottom: '1.75rem' }}>
        <SkeletonLine width="10rem" height="1rem" />
      </div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '0.375rem' }}>
          <SkeletonCard style={{ width: '40px', height: '40px', padding: 0 }} />
          <SkeletonLine width="14rem" height="2.5rem" />
        </div>
        <SkeletonLine width="8rem" height="1rem" />
      </div>

      <SkeletonCard style={{ height: '140px', marginBottom: '1.5rem' }} />

      <div style={{ marginBottom: '1.5rem' }}>
        <SkeletonLine width="6rem" height="1rem" style={{ marginBottom: '0.875rem' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} style={{ height: '72px', padding: 0 }} />)}
        </div>
      </div>

      <SkeletonCard style={{ height: '100px' }} />
    </AppShell>
  )
}
