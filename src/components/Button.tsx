import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const styles: Record<Variant, object> = {
  primary: {
    background: 'var(--color-accent)',
    color: '#fff',
    border: '1px solid var(--color-accent)',
  },
  secondary: {
    background: 'var(--color-card)',
    color: 'var(--color-ink)',
    border: '1px solid var(--color-line)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-ink-2)',
    border: '1px solid transparent',
  },
  danger: {
    background: 'var(--color-card)',
    color: 'var(--color-red)',
    border: '1px solid var(--color-line)',
  },
}

const sizes: Record<Size, object> = {
  sm: { fontSize: '0.75rem', padding: '0.3125rem 0.75rem', borderRadius: '8px' },
  md: { fontSize: '0.8125rem', padding: '0.5rem 1.125rem', borderRadius: '10px' },
  lg: { fontSize: '0.9375rem', padding: '0.6875rem 1.5rem', borderRadius: '12px' },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 600,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        transition: 'opacity 0.15s, box-shadow 0.15s',
        letterSpacing: '-0.01em',
        ...styles[variant],
        ...sizes[size],
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      {...props}
    >
      {children}
    </button>
  )
}
