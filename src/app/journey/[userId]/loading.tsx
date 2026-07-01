import AppShell from '@/components/AppShell'
import { SkeletonCard, SkeletonLine } from '@/components/States'

export default function JourneyDetailLoading() {
  return (
    <AppShell maxWidth="52rem">
      <div style={{ marginBottom: '1.75rem' }}>
        <SkeletonLine width="10rem" height="1rem" />
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <SkeletonLine width="6rem" height="1rem" style={{ marginBottom: '0.375rem' }} />
        <SkeletonLine width="16rem" height="2.5rem" style={{ marginBottom: '0.5rem' }} />
        <SkeletonLine width="10rem" height="1rem" />
      </div>

      <div style={{ position: 'relative', paddingLeft: '1.25rem', marginTop: '1.5rem' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '5px', width: '2px', background: 'var(--color-line)' }} />
        
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <div
              style={{
                position: 'absolute',
                left: '-1.25rem',
                top: '0.25rem',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: 'var(--color-paper-2)',
                border: '2px solid var(--color-line)',
                transform: 'translateX(-50%)',
                zIndex: 1,
              }}
            />
            <SkeletonCard style={{ height: '80px', padding: 0 }} />
          </div>
        ))}
      </div>
    </AppShell>
  )
}
