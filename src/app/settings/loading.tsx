import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function SettingsLoading() {
  return (
    <AppShell maxWidth="52rem">
      <div style={{ marginBottom: '2.5rem' }}>
        <SkeletonLine width="10rem" height="2.5rem" />
      </div>

      {Array.from({ length: 5 }).map((_, i) => (
        <section key={i} style={{ marginBottom: '2.5rem' }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <SkeletonLine width="10rem" height="1.25rem" style={{ marginBottom: '0.25rem' }} />
            <SkeletonLine width="20rem" height="1rem" />
          </div>
          <SkeletonCard style={{ height: '160px' }} />
        </section>
      ))}
    </AppShell>
  )
}
