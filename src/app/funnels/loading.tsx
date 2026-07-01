import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function FunnelsLoading() {
  return (
    <AppShell>
      <div style={{ marginBottom: '2.25rem' }}>
        <SkeletonLine width="10rem" height="2.5rem" style={{ marginBottom: '0.25rem' }} />
        <SkeletonLine width="20rem" height="1rem" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} style={{ height: '160px' }} />)}
      </div>

      <div style={{ marginBottom: '0.875rem' }}>
        <SkeletonLine width="6rem" height="1rem" />
      </div>
      <SkeletonCard style={{ height: '360px' }} />
    </AppShell>
  )
}
