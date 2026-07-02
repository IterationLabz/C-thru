'use client'

import { useRouter } from 'next/navigation'
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { chartColors, tickStyle, tooltipContentStyle, tooltipLabelStyle, readinessColor } from './chartTheme'

export interface ReadinessItem {
  domain: string
  label: string
  met: number
  total: number
}

// Long domains (e.g. "verify-test.example") can overflow the fixed label column and
// get clipped against the page edge if the surrounding Card has little horizontal
// padding — truncate defensively rather than relying on callers to size things right.
// The full name still shows in the tooltip on hover (unaffected by tickFormatter).
function truncateLabel(label: string): string {
  return label.length > 16 ? `${label.slice(0, 15)}…` : label
}

export default function ReadinessBarChart({ items }: { items: ReadinessItem[] }) {
  const router = useRouter()
  const data = items.map(i => ({
    ...i,
    pct: i.total === 0 ? 0 : Math.round((i.met / i.total) * 100),
  }))
  const height = Math.max(data.length * 34, 60)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          tickFormatter={truncateLabel}
          tick={{ ...tickStyle, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(_value, _name, props) => {
            const p = props.payload as unknown as { met: number; total: number; pct: number }
            return [`${p.met}/${p.total} rules met (${p.pct}%)`, '']
          }}
          cursor={{ fill: chartColors.paper2 }}
        />
        <Bar dataKey="pct" radius={[0, 3, 3, 0]} maxBarSize={16}>
          {data.map(d => (
            <Cell 
              key={d.domain} 
              fill={readinessColor(d.pct)} 
              onClick={() => router.push(`/accounts/${d.domain}`)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
