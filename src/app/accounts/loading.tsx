import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function AccountsLoading() {
  return (
    <AppShell maxWidth="60rem">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.25rem' }}>
        <div>
          <SkeletonLine width="12rem" height="2.5rem" />
          <div style={{ marginTop: '0.5rem' }}>
            <SkeletonLine width="16rem" height="1rem" />
          </div>
        </div>
        <SkeletonLine width="4rem" height="1rem" />
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <SkeletonLine width="8rem" height="1rem" style={{ marginBottom: '0.875rem' }} />
        <SkeletonCard style={{ height: '180px' }} />
      </div>

      <SkeletonCard style={{ height: '400px' }} />
    </AppShell>
  )
}
