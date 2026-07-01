import { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  padding?: string
  mockupWindow?: boolean
  title?: string
}

export default function Card({ children, className = '', style, padding = '1.5rem', mockupWindow = false, title }: CardProps) {
  if (mockupWindow) {
    return (
      <div style={{
        background: 'var(--color-card)',
        borderRadius: '8px',
        border: '1px solid var(--color-line)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }} className={className}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-line)',
          background: 'var(--color-card)',
        }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2DFD7' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2DFD7' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#E2DFD7' }} />
          </div>
          {title && (
            <div style={{ margin: '0 auto', fontSize: '0.75rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-ink-2)' }}>
              {title}
            </div>
          )}
        </div>
        <div style={{ padding, flex: 1 }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-line)',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        padding,
        ...style,
      }}
      className={className}
    >
      {children}
    </div>
  )
}
