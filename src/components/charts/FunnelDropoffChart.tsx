'use client'

import { BarChart, Bar, Cell, LabelList, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { chartColors, tickStyle, tooltipContentStyle, tooltipLabelStyle } from './chartTheme'

export interface FunnelStepDatum {
  eventName: string
  count: number
  dropoffPct: number
}

function stepColor(index: number, total: number): string {
  if (index === 0) return chartColors.accent
  const t = total <= 1 ? 0 : index / (total - 1)
  // Fade from accent toward accent-2 across the funnel steps.
  return t > 0.5 ? chartColors.accent2 : chartColors.accent
}

export default function FunnelDropoffChart({ steps }: { steps: FunnelStepDatum[] }) {
  const height = Math.max(steps.length * 44, 80)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={steps}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 0, bottom: 4 }}
        barCategoryGap={10}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="eventName"
          tick={{ ...tickStyle, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(_value, _name, props) => {
            const p = props.payload as unknown as FunnelStepDatum
            const dropoff = p.dropoffPct > 0 ? ` (−${p.dropoffPct}% from prior step)` : ''
            return [`${p.count.toLocaleString()}${dropoff}`, '']
          }}
          cursor={{ fill: chartColors.paper2 }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={22}>
          {steps.map((s, i) => (
            <Cell key={s.eventName} fill={stepColor(i, steps.length)} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            formatter={value => Number(value).toLocaleString()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fill: chartColors.ink2 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
