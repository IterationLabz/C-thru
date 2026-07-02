'use client'

import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { chartColors, gridStroke, tickStyle, tooltipContentStyle, tooltipLabelStyle, tooltipItemStyle } from './chartTheme'

export interface EventsOverTimePoint {
  date: string   // YYYY-MM-DD
  count: number
}

function formatTick(date: string): string {
  const d = new Date(date + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function EventsOverTimeChart({ data }: { data: EventsOverTimePoint[] }) {
  const router = useRouter()
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          tick={tickStyle}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis tick={tickStyle} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          itemStyle={tooltipItemStyle}
          labelFormatter={label => formatTick(String(label))}
          formatter={value => [Number(value).toLocaleString(), 'Events']}
          cursor={{ fill: chartColors.paper2 }}
        />
        <Bar 
          dataKey="count" 
          fill={chartColors.accent} 
          radius={[3, 3, 0, 0]} 
          onClick={(data: any) => {
            if (data && data.date) {
              router.push(`/ask?q=${encodeURIComponent(`Show events on ${data.date}`)}`)
            }
          }}
          style={{ cursor: 'pointer' }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
