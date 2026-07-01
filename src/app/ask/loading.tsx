import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function AskLoading() {
  return (
    <AppShell maxWidth="52rem">
      <div style={{ marginBottom: '2.5rem' }}>
        <SkeletonLine width="8rem" height="2.5rem" style={{ marginBottom: '0.375rem' }} />
        <SkeletonLine width="24rem" height="1rem" />
        <div style={{ marginTop: '0.5rem' }}>
          <SkeletonLine width="16rem" height="1rem" />
        </div>
      </div>

      <SkeletonCard style={{ height: '140px', marginBottom: '2.5rem' }} />

      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
          <SkeletonLine width="6rem" height="1rem" />
          <SkeletonLine width="6rem" height="1rem" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} style={{ height: '100px' }} />)}
        </div>
      </section>
    </AppShell>
  )
}
