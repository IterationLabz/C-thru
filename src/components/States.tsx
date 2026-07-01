import { ReactNode } from 'react'
import Card from './Card'

/* ── Empty state ── */
interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <Card
      style={{
        textAlign: 'center',
        padding: '3.5rem 2rem',
        border: '1px dashed var(--color-line)',
        background: 'transparent',
        boxShadow: 'none',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.0625rem',
          fontWeight: 500,
          color: 'var(--color-ink-2)',
          marginBottom: description ? '0.5rem' : action ? '1rem' : 0,
        }}
      >
        {title}
      </p>
      {description && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink-3)', marginBottom: action ? '1.25rem' : 0 }}>
          {description}
        </p>
      )}
      {action}
    </Card>
  )
}

/* ── Skeleton loader ── */
export function SkeletonLine({ width = '100%', height = '1rem', style }: { width?: string; height?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width,
        height,
        background: 'var(--color-paper-2)',
        borderRadius: '6px',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export function SkeletonCard({ style }: { style?: React.CSSProperties }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', ...style }}>
      <SkeletonLine width="40%" height="0.75rem" />
      <SkeletonLine width="60%" height="2rem" />
      <SkeletonLine width="50%" height="0.75rem" />
    </Card>
  )
}

/* ── Error / retry block ── */
interface ErrorBlockProps {
  message: string
  onRetry?: () => void
}

export function ErrorBlock({ message, onRetry }: ErrorBlockProps) {
  return (
    <Card
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(163,70,47,0.05)',
        border: '1px solid rgba(163,70,47,0.2)',
        padding: '0.875rem 1.25rem',
        gap: '1rem',
      }}
    >
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-red)' }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-red)',
            background: 'transparent',
            border: '1px solid rgba(163,70,47,0.3)',
            borderRadius: '8px',
            padding: '0.25rem 0.75rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Retry
        </button>
      )}
    </Card>
  )
}
