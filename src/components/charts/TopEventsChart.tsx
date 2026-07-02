'use client'

import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { chartColors, tickStyle, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './chartTheme'

export interface TopEventItem {
  label: string
  value: number
}

export default function TopEventsChart({ items }: { items: TopEventItem[] }) {
  const router = useRouter()
  const height = Math.max(items.length * 34, 60)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={items}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
        barCategoryGap={8}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...tickStyle, fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={128}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          formatter={value => [Number(value).toLocaleString(), 'Count']}
          cursor={{ fill: chartColors.paper2 }}
        />
        <Bar 
          dataKey="value" 
          fill={chartColors.accent} 
          radius={[0, 3, 3, 0]} 
          maxBarSize={16} 
          onClick={(data: any) => {
            if (data && data.label) {
              router.push(`/ask?q=${encodeURIComponent(`Show count for event ${data.label}`)}`)
            }
          }}
          style={{ cursor: 'pointer' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
