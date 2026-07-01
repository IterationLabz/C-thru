import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function OutreachLoading() {
  return (
    <AppShell>
      <div style={{ marginBottom: '2.5rem' }}>
        <SkeletonLine width="10rem" height="2.5rem" style={{ marginBottom: '0.375rem' }} />
        <SkeletonLine width="18rem" height="1rem" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} style={{ height: '140px' }} />)}
      </div>
    </AppShell>
  )
}
