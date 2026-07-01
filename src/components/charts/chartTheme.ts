// Shared Recharts theme constants — mirrors the tokens in globals.css.
// Hex literals (not var(--...)) are used deliberately: Recharts renders numeric
// chart geometry (e.g. gradient stops, computed label widths) in contexts where
// CSS custom properties don't reliably resolve, so we keep one literal source of
// truth here instead of depending on var() resolution inside SVG.
export const chartColors = {
  accent: '#B85C48',
  accent2: '#C89B6A',
  sage: '#7C8471',
  slate: '#6B7280',
  green: '#5B7A46',
  amber: '#B4791F',
  ink: '#1C1A17',
  ink2: '#6B6455',
  ink3: '#9C9484',
  line: '#E7E1D5',
  paper2: '#F1EDE4',
  card: '#FFFFFF',
}

export const gridStroke = '#EFEAE0'

export const seriesColors = [chartColors.accent, chartColors.accent2, chartColors.sage, chartColors.slate]

export const tickStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fill: chartColors.ink3,
}

export const tooltipContentStyle: React.CSSProperties = {
  background: chartColors.card,
  border: `1px solid ${chartColors.line}`,
  borderRadius: 8,
  boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  padding: '0.5rem 0.75rem',
  fontFamily: 'var(--font-sans)',
  fontSize: '0.75rem',
}

export const tooltipLabelStyle: React.CSSProperties = {
  fontWeight: 600,
  color: chartColors.ink,
  marginBottom: '0.25rem',
}

export const tooltipItemStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  color: chartColors.ink2,
}

export function readinessColor(pct: number): string {
  return pct >= 60 ? chartColors.green : pct >= 40 ? chartColors.amber : chartColors.ink3
}
