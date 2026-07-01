/**
 * Design-phase chart placeholders. These convey shape and palette — no real data.
 * Recharts / real data wiring is a separate later phase.
 */

/* ── Bar chart (events over time) ── */
export function BarChartPlaceholder({ label = 'Events over time' }: { label?: string }) {
  const bars = [42, 68, 55, 90, 73, 61, 84, 47, 78, 95, 66, 52, 88, 71]
  const max = Math.max(...bars)

  return (
    <div style={{ width: '100%' }}>
      <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-ink-3)', marginBottom: '1rem' }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${(h / max) * 100}%`,
              background: 'var(--color-ink)',
              borderRadius: '4px 4px 0 0',
              opacity: 0.7 + (i / bars.length) * 0.3,
            }}
          />
        ))}
      </div>
      <div
        style={{
          borderTop: '1px solid var(--color-line)',
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '0.5rem',
          marginTop: '2px',
        }}
      >
        {['14d ago', '', '', '', '7d ago', '', '', '', '', 'Today'].map((t, i) => (
          <span key={i} style={{ fontSize: '0.625rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-3)' }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Sparkline (inline small) ── */
export function SparklinePlaceholder() {
  const pts = [30, 45, 38, 55, 48, 62, 58, 70, 65, 80]
  const max = Math.max(...pts), min = Math.min(...pts)
  const range = max - min || 1
  const w = 64, h = 24

  const polyline = pts
    .map((v, i) => `${(i / (pts.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--color-ink)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ── Horizontal bar list (top events) ── */
export function HorizontalBarPlaceholder({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map(i => i.value))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {items.map(({ label, value }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-ink-2)', minWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
          <div style={{ flex: 1, height: '8px', background: 'var(--color-paper-2)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: 'var(--color-ink)', borderRadius: '4px' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--color-ink-3)', minWidth: '2.5rem', textAlign: 'right' }}>
            {value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Funnel placeholder ── */
export function FunnelPlaceholder({ steps }: { steps: { label: string; count: number; pct?: number }[] }) {
  const max = steps[0]?.count ?? 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
      {steps.map(({ label, count, pct }, i) => {
        const width = `${Math.max(20, (count / max) * 100)}%`
        return (
          <div key={i} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            {i > 0 && pct !== undefined && (
              <p style={{ fontSize: '0.6875rem', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)' }}>
                ↓ {pct}% converted
              </p>
            )}
            <div
              style={{
                width,
                background: i === 0 ? 'var(--color-ink)' : `rgba(28,26,23,${0.7 - i * 0.12})`,
                borderRadius: '6px',
                padding: '0.5rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff' }}>{label}</span>
              <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.85)' }}>
                {count.toLocaleString()}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Score bar ── */
export function ScoreBar({ met, total }: { met: number; total: number }) {
  const pct = total === 0 ? 0 : (met / total) * 100
  const color = pct >= 60 ? 'var(--color-green)' : pct >= 40 ? 'var(--color-amber)' : 'var(--color-ink-3)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ width: '5rem', height: '5px', background: 'var(--color-paper-2)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px' }} />
      </div>
      <span style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--color-ink-2)', fontWeight: 600 }}>
        {met}/{total}
      </span>
    </div>
  )
}
