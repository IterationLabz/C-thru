import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function DashboardLoading() {
  return (
    <AppShell>
      <div style={{ marginBottom: '2.25rem' }}>
        <SkeletonLine width="16rem" height="2.5rem" />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1rem', marginBottom: '1rem' }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1rem', marginBottom: '2.5rem' }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonCard />
    </AppShell>
  )
}
