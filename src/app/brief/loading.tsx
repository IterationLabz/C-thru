import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function BriefLoading() {
  return (
    <AppShell maxWidth="52rem">
      <div style={{ marginBottom: '2.5rem' }}>
        <SkeletonLine width="6rem" height="1rem" style={{ marginBottom: '0.5rem' }} />
        <SkeletonLine width="14rem" height="2.5rem" />
      </div>

      <SkeletonCard style={{ height: '100px', marginBottom: '2rem' }} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} style={{ height: '110px' }} />)}
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <SkeletonLine width="6rem" height="1rem" style={{ marginBottom: '0.875rem' }} />
        <SkeletonCard style={{ height: '80px' }} />
      </section>

      <section>
        <SkeletonLine width="8rem" height="1rem" style={{ marginBottom: '0.875rem' }} />
        <SkeletonCard style={{ height: '240px' }} />
      </section>
    </AppShell>
  )
}
