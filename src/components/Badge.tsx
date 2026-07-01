import { ReactNode } from 'react'

type BadgeColor = 'green' | 'amber' | 'red' | 'accent' | 'sage' | 'neutral'

interface BadgeProps {
  color?: BadgeColor
  children: ReactNode
}

const colorMap: Record<BadgeColor, { bg: string; text: string }> = {
  green:   { bg: 'rgba(91,122,70,0.12)',   text: 'var(--color-green)'  },
  amber:   { bg: 'rgba(180,121,31,0.12)',  text: 'var(--color-amber)'  },
  red:     { bg: 'rgba(163,70,47,0.12)',   text: 'var(--color-red)'    },
  accent:  { bg: 'rgba(184,92,72,0.12)',   text: 'var(--color-accent)' },
  sage:    { bg: 'rgba(124,132,113,0.12)', text: 'var(--color-sage)'   },
  neutral: { bg: 'var(--color-paper-2)',   text: 'var(--color-ink-2)'  },
}

export default function Badge({ color = 'neutral', children }: BadgeProps) {
  const { bg, text } = colorMap[color]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: bg,
        color: text,
        fontSize: '0.6875rem',
        fontWeight: 600,
        fontFamily: 'var(--font-sans)',
        letterSpacing: '0.02em',
        padding: '0.1875rem 0.5rem',
        borderRadius: '6px',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}
