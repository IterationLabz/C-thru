import Card from './Card'

interface TrendChipProps {
  direction: 'up' | 'down' | 'flat'
  label: string
}

export function TrendChip({ direction, label }: TrendChipProps) {
  const color =
    direction === 'up'   ? 'var(--color-green)' :
    direction === 'down' ? 'var(--color-red)'   :
    'var(--color-ink-3)'

  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color,
        background: direction === 'up'
          ? 'rgba(91,122,70,0.1)'
          : direction === 'down'
          ? 'rgba(163,70,47,0.1)'
          : 'var(--color-paper-2)',
        padding: '0.125rem 0.4375rem',
        borderRadius: '6px',
      }}
    >
      {arrow} {label}
    </span>
  )
}

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  trend?: { direction: 'up' | 'down' | 'flat'; label: string }
  live?: boolean
}

export default function MetricCard({ label, value, sub, trend, live }: MetricCardProps) {
  return (
    <Card padding="1.5rem">
      <p
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-3)',
          fontFamily: 'var(--font-sans)',
          marginBottom: '0.75rem',
        }}
      >
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.625rem', flexWrap: 'wrap' }}>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
            lineHeight: 1,
          }}
        >
          {live && (
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-green)',
                marginRight: '0.5rem',
                verticalAlign: 'middle',
                animation: 'pulse 2s infinite',
              }}
            />
          )}
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {trend && <TrendChip {...trend} />}
      </div>
      {sub && (
        <p
          style={{
            fontSize: '0.75rem',
            color: 'var(--color-ink-3)',
            marginTop: '0.5rem',
          }}
        >
          {sub}
        </p>
      )}
    </Card>
  )
}
